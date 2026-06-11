// ------------------------------------------------------------------
// --- BIBLIOTECAS ---
// ------------------------------------------------------------------
#include <ESP32-TWAI-CAN.hpp> 
#include <PubSubClient.h>      
#include <WiFi.h>              
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include <ArduinoJson.h>  
#include "time.h"
#include <Wire.h>              // Biblioteca I2C para o MPU-6050
#include <MPU6050.h>           // Biblioteca do MPU-6050 (instale via Library Manager)
#include "../../config/constants.h"

// ------------------------------------------------------------------
// --- CONFIGURAÇÕES DE PINOS E REDE ---
// ------------------------------------------------------------------
#define CAN_TX_PIN 2
#define CAN_RX_PIN 15
#define ledCAN 16
#define ledMQTT 17

// Pinos I2C para o MPU-6050 (ESP32 padrão: SDA=21, SCL=22)
// Altere conforme sua ligação física
#define I2C_SDA 16
#define I2C_SCL 17

#define TESTMODE true  // Se true, gera dados aleatórios para teste sem hardware CAN
#define DEBUGMODE false
#define BufferSize 250  // Buffer aumentado para evitar perda em latências de rede

const char *ssid = "Voltz";
const char *password = "12345678";
const char *serverAddress = "192.168.43.168";
const char* MQTT_TOPIC = "moto/telemetria";
const int mqtt_port = 1883;

const TwaiSpeed CAN_SPEED = TWAI_SPEED_250KBPS;

// Configurações do Fuso Horário (Brasil - Pernambuco)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -3 * 3600; 
const int daylightOffset_sec = 0;      

// Intervalo que a Task MQTT acorda para limpar a fila (50ms)
const TickType_t TRANSMIT_INTERVAL = pdMS_TO_TICKS(50);

// ------------------------------------------------------------------
// --- ESTRUTURAS E VARIÁVEIS GLOBAIS ---
// ------------------------------------------------------------------

struct CanMessage {
  uint32_t id;
  uint8_t data[8];
  uint8_t length;
  bool isExtended;
  int64_t timestamp; // Armazena o momento exato da leitura do CAN
};

WiFiClient espClient;
PubSubClient client(espClient);
QueueHandle_t canRawQueue;

// Instância do MPU-6050
MPU6050 mpu;

// Variáveis para armazenar leituras do MPU-6050
int16_t ax, ay, az;  // Acelerômetro (raw)
int16_t gx, gy, gz;  // Giroscópio (raw)
float ax_g, ay_g, az_g;  // Acelerômetro em g (gravidade)
float gx_dps, gy_dps, gz_dps;  // Giroscópio em graus/segundo

// ------------------------------------------------------------------
// --- FUNÇÕES AUXILIARES ---
// ------------------------------------------------------------------

/**
 * @brief Reconecta ao broker MQTT caso a conexão seja perdida
 */
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  while (!client.connected()) {
    Serial.print("Tentando conectar MQTT...");
    String clientId = "ESP32-Voltz-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Conectado!");
    } else {
      Serial.print("falha, rc=");
      Serial.print(client.state());
      Serial.println(" tentando novamente em 2s");
      vTaskDelay(pdMS_TO_TICKS(2000));
    }
  }
}

/**
 * @brief Lê os dados do MPU-6050 e converte para unidades físicas
 * @note Deve ser chamado apenas pela task MQTT para evitar conflito no barramento I2C
 */
void readMPU6050() {
  // Lê valores brutos do sensor
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  
  // Converte acelerômetro: raw (±2g padrão) → valor em g (gravidade)
  // Fórmula: valor_raw / 16384 = g (para escala ±2g)
  ax_g = ax / 16384.0;
  ay_g = ay / 16384.0;
  az_g = az / 16384.0;
  
  // Converte giroscópio: raw (±250°/s padrão) → graus por segundo
  // Fórmula: valor_raw / 131 = °/s (para escala ±250°/s)
  gx_dps = gx / 131.0;
  gy_dps = gy / 131.0;
  gz_dps = gz / 131.0;
}

// ------------------------------------------------------------------
// --- TAREFAS (FREERTOS) ---
// ------------------------------------------------------------------

/**
 * @brief Task Core 0: Leitura de Alta Velocidade do barramento CAN
 * @details Captura frames CAN e os envia para a fila com timestamp preciso
 */
void canSourceTask(void* pvParameters) {
  for (;;) {
    CanMessage frame;
    bool hasData = false;

    if (TESTMODE) {
      // --- MODO SIMULAÇÃO: Gera dados aleatórios para teste ---
      frame.id = (random(0, 2) == 0) ? BASE_BATTERY_ID : BASE_CONTROLLER_ID;
      frame.length = 8;
      frame.isExtended = false;
      for (int i = 0; i < 8; i++) {
        if (i == 5) {
          int choice = random(0, 3);  
          switch (choice) {
            case 0: frame.data[i] = 0x45; break;
            case 1: frame.data[i] = 0x4D; break;
            case 2: frame.data[i] = 0x55; break;
          }
        } else {
          frame.data[i] = random(0, 255);
        }
      }
      
      // Timestamp da simulação usando gettimeofday
      struct timeval tv_now;
      gettimeofday(&tv_now, NULL);
      frame.timestamp = (int64_t)tv_now.tv_sec * 1000LL + (tv_now.tv_usec / 1000LL);
      
      hasData = true;
      vTaskDelay(pdMS_TO_TICKS(20)); // Simula intervalo entre frames
    } else {
      CanFrame rx;
      // Tenta ler um frame CAN com timeout de 10ms
      if (ESP32Can.readFrame(rx, 10)) {
        digitalWrite(ledCAN, !digitalRead(ledCAN)); 
        
        // CAPTURA DO TIMESTAMP NO MOMENTO EXATO DA CHEGADA DO FRAME
        struct timeval tv_now;
        gettimeofday(&tv_now, NULL);
        frame.timestamp = (int64_t)tv_now.tv_sec * 1000LL + (tv_now.tv_usec / 1000LL);

        frame.id = rx.identifier;
        frame.length = rx.data_length_code;
        frame.isExtended = rx.extd;
        memcpy(frame.data, rx.data, rx.data_length_code);
        hasData = true;
      }
    }

    // Envia frame para a fila de processamento (Core 1)
    if (hasData) {
      if (xQueueSend(canRawQueue, &frame, 0) != pdTRUE) {
        if (DEBUGMODE) Serial.println("Fila de processamento cheia!");
      }
    }
    vTaskDelay(0); // Cede tempo para o IDLE do Core 0 (evita starvation)
  }
}

/**
 * @brief Task Core 1: Gestão Wi-Fi, Leitura MPU-6050 e Publicação MQTT em Lote
 * @details Processa frames da fila CAN, lê sensor MPU-6050 e publica JSON no MQTT
 */
void mqttPublisherTask(void* pvParameters) {
  CanMessage rawFrame;
  char jsonBuffer[512];  // Buffer aumentado para incluir dados do MPU-6050
  TickType_t xLastWakeTime = xTaskGetTickCount();

  client.setServer(serverAddress, mqtt_port);

  for (;;) {
    // --- MANUTENÇÃO DA CONEXÃO WiFi ---
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.begin(ssid, password);
      int timeout = 0;
      while (WiFi.status() != WL_CONNECTED && timeout < 10) {
        vTaskDelay(pdMS_TO_TICKS(500));
        timeout++;
      }
    }

    // --- MANUTENÇÃO DA CONEXÃO MQTT ---
    if (WiFi.status() == WL_CONNECTED && !client.connected()) {
      reconnectMQTT();
    }
    client.loop();

    // --- PROCESSAMENTO EM LOTE: Esvazia toda a fila acumulada ---
    while (xQueueReceive(canRawQueue, &rawFrame, 0) == pdTRUE) {
      digitalWrite(ledMQTT, HIGH);

      // Lê dados do MPU-6050 ANTES de montar o JSON
      // (Importante: leitura feita apenas nesta task para evitar conflito I2C)
      readMPU6050();

      // Monta documento JSON com dados CAN + MPU-6050
      StaticJsonDocument<512> doc;  // Aumentado para comportar mais campos
      
      // Dados do barramento CAN
      doc["canId"] = rawFrame.id;
      doc["ide"] = rawFrame.isExtended;
      doc["dlc"] = rawFrame.length;
      
      // Converte dados CAN para string hexadecimal formatada
      char dataHex[25]; 
      char* ptr = dataHex;
      for (int i = 0; i < rawFrame.length; i++) {
        ptr += sprintf(ptr, i == 0 ? "%02X" : " %02X", rawFrame.data[i]);
      }
      doc["data"] = dataHex;
      
      // Timestamp original da captura do frame CAN (em ms desde epoch)
      doc["ts"] = rawFrame.timestamp; 

      // --- DADOS DO MPU-6050 (adicionados ao mesmo pacote) ---
      doc["mpu"]["ax_g"] = ax_g;        // Aceleração X em g
      doc["mpu"]["ay_g"] = ay_g;        // Aceleração Y em g
      doc["mpu"]["az_g"] = az_g;        // Aceleração Z em g
      doc["mpu"]["gx_dps"] = gx_dps;    // Velocidade angular X em °/s
      doc["mpu"]["gy_dps"] = gy_dps;    // Velocidade angular Y em °/s
      doc["mpu"]["gz_dps"] = gz_dps;    // Velocidade angular Z em °/s
      doc["mpu"]["ts_mpu"] = millis();  // Timestamp relativo da leitura do MPU

      // Serializa o JSON para o buffer de envio
      serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));

      // Publica no tópico MQTT se estiver conectado
      if (client.connected()) {
        client.publish(MQTT_TOPIC, jsonBuffer);
      }
      
      digitalWrite(ledMQTT, LOW);
      vTaskDelay(0); // Cede tempo para a stack Wi-Fi processar
    }

    // Aguarda até o próximo ciclo de transmissão (controla a taxa de publicação)
    vTaskDelayUntil(&xLastWakeTime, TRANSMIT_INTERVAL);
  }
}

// ------------------------------------------------------------------
// --- SETUP E LOOP ---
// ------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println("=== Iniciando Sistema ESP32 + CAN + MPU-6050 + MQTT ===");

  // Configura LEDs de status
  pinMode(ledCAN, OUTPUT);
  pinMode(ledMQTT, OUTPUT);

  // Criação da fila de mensagens CAN (BufferSize x tamanho da struct)
  canRawQueue = xQueueCreate(BufferSize, sizeof(CanMessage));

  // Inicializa barramento I2C para o MPU-6050
  Wire.begin(I2C_SDA, I2C_SCL);
  Serial.println("Inicializando MPU-6050...");
  
  // Inicializa o sensor MPU-6050
  mpu.initialize();
  
  // Verifica comunicação com o sensor
  if (mpu.testConnection()) {
    Serial.println("MPU-6050 conectado com sucesso!");
    
    // Configurações opcionais do sensor (ajuste conforme necessidade)
    mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);   // ±2g (maior precisão)
    mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);   // ±250°/s (maior precisão)
    mpu.setDLPFMode(MPU6050_DLPF_BW_98);              // Filtro digital: 98Hz
  } else {
    Serial.println("ERRO: Falha na comunicação com MPU-6050. Verifique conexões I2C.");
    // Sistema continua sem o sensor (modo degradado)
  }

  // Início da conexão WiFi
  Serial.print("Conectando ao WiFi ");
  Serial.print(ssid);
  Serial.print("... ");
  WiFi.begin(ssid, password);
  
  // Aguarda conexão WiFi com timeout
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) {
    delay(500);
    Serial.print(".");
    wifiTimeout++;
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? "Conectado!" : "Falha!");

  // Configuração do NTP para sincronizar timestamp real (UTC)
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Sincronizando horário com NTP...");

  // Inicialização do Driver CAN (TWAI)
  ESP32Can.setPins(CAN_TX_PIN, CAN_RX_PIN);
  if (!TESTMODE) {
    if (!ESP32Can.begin(CAN_SPEED)) {
      Serial.println("CRÍTICO: Falha ao iniciar barramento CAN");
      while (1) {
        digitalWrite(ledCAN, HIGH);
        delay(200);
        digitalWrite(ledCAN, LOW);
        delay(200);
      }
    }
    Serial.println("Barramento CAN inicializado com sucesso!");
  } else {
    Serial.println("MODO TESTE ATIVADO: Dados CAN simulados");
  }

  // ----------------------------------------------------------------
  // --- CRIAÇÃO DAS TASKS COM PINO EM NÚCLEOS ESPECÍFICOS ---
  // ----------------------------------------------------------------
  
  // Task de leitura CAN no Core 0 
  // Prioridade 3 (alta) para garantir baixa latência na captura
  xTaskCreatePinnedToCore(
    canSourceTask,      // Função da task
    "CAN_Source",       // Nome para debug
    4096,               // Stack size em palavras (4KB)
    NULL,               // Parâmetro
    3,                  // Prioridade (0-24, quanto maior = mais prioridade)
    NULL,               // Handle da task (não usado)
    0                   // Núcleo 0 (responsável por periféricos de tempo real)
  ); 
  Serial.println("Task CAN_Source criada no Core 0");
  
  // Task de Wi-Fi/MQTT/MPU no Core 1 
  // Prioridade 1 (menor) pois tolera pequenas latências
  xTaskCreatePinnedToCore(
    mqttPublisherTask,  // Função da task
    "MQTT_Pub",         // Nome para debug
    8192,               // Stack maior para JSON + WiFi + I2C
    NULL,               // Parâmetro
    1,                  // Prioridade baixa
    NULL,               // Handle
    1                   // Núcleo 1 (responsável por WiFi e tarefas de rede)
  );
  Serial.println("Task MQTT_Pub criada no Core 1");
  
  Serial.println("=== Sistema inicializado. Tasks rodando. ===");
}

/**
 * @brief Função loop principal
 * @details Deletada para economizar recursos. Todo o processamento 
 *          é feito nas tasks do FreeRTOS.
 */
void loop() {
  // Deleta a task padrão do Arduino para liberar stack e CPU
  vTaskDelete(NULL); 
}