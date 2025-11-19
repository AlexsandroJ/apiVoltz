#include <ESP32-TWAI-CAN.hpp>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

// ------------------------------------------------------------------
// --- CONFIGURAÇÃO DE PINOS E VELOCIDADE ---
// ------------------------------------------------------------------
#define CAN_TX_PIN 5
#define CAN_RX_PIN 4
const TwaiSpeed CAN_SPEED = TWAI_SPEED_250KBPS;

// IDs base
#define BASE_BATTERY_ID     0x120  // ID base para dados da bateria (BMS)
#define BASE_CONTROLLER_ID  0x300  // ID base para dados do motor/controlador

// Variáveis para armazenar os dados decodificados
struct BatteryData {
  int current = 0;
  int voltage = 0;
  int soc = 0;
  int soh = 0;
  int temperature = 0;
  bool valid = false;
} battery;

struct MotorControllerData {
  int motorSpeedRpm = 0;
  float motorTorque = 0.0;
  int motorTemperature = 0;
  int controllerTemperature = 0;
  bool valid = false;
} motorController;

// Mutex para proteger acesso concorrente às variáveis de dados
SemaphoreHandle_t dataMutex;

// Configuração Wi-Fi e WebServer
const char* ssid = "CINGUESTS";
const char* password = "acessocin";
WebServer server(80);

// ------------------------------------------------------------------
// --- FUNÇÕES DE DECODIFICAÇÃO ---
// ------------------------------------------------------------------
void decodeBatteryData(byte* data) {
  // current = np.int_((cadeia_bytes[2] * 256) + cadeia_bytes[3] * 0.1)
  battery.current = (int)((data[2] * 256 + data[3]) * 0.1);
  
  // voltage = np.int_((cadeia_bytes[0] * 256) + cadeia_bytes[1] * 0.1)
  battery.voltage = (int)((data[0] * 256 + data[1]) * 0.1);
  
  // SoC = np.int_(cadeia_bytes[6])
  battery.soc = (int)data[6];
  
  // SoH = np.int_(cadeia_bytes[7])
  battery.soh = (int)data[7];
  
  // temperature = np.int_(cadeia_bytes[4])
  battery.temperature = (int)data[4];
  
  battery.valid = true;
}

void decodeMotorControllerData(byte* data) {
  // motor_speed_rpm = np.int_((cadeia_bytes[0] * 256) + cadeia_bytes[1])
  motorController.motorSpeedRpm = (int)(data[0] * 256 + data[1]);
  
  // motor_torque = np.int_((cadeia_bytes[2] * 256) + cadeia_bytes[3] * 0.1)
  motorController.motorTorque = (float)((data[2] * 256 + data[3]) * 0.1);
  
  // motor_temperature = np.int_(cadeia_bytes[7] - 40)
  motorController.motorTemperature = (int)(data[7] - 40);
  
  // controller_temperature = np.int_(cadeia_bytes[6] - 40)
  motorController.controllerTemperature = (int)(data[6] - 40);
  
  motorController.valid = true;
}

// ------------------------------------------------------------------
// --- TAREFA PARA LEITURA CAN ---
// ------------------------------------------------------------------
void canTask(void *pvParameters) {
  twai_message_t rxFrame;
  
  while (true) {
    if (ESP32Can.readFrame(&rxFrame)) {
      // Verifica se é um frame estendido
      if (rxFrame.flags & TWAI_MSG_FLAG_EXTD) {
        unsigned long id = rxFrame.identifier;
        
        // Protege acesso às variáveis de dados
        if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
          if (id == BASE_BATTERY_ID) {
            decodeBatteryData(rxFrame.data);
            Serial.println("Dados da bateria recebidos e decodificados!");
          } else if (id == BASE_CONTROLLER_ID) {
            decodeMotorControllerData(rxFrame.data);
            Serial.println("Dados do motor/controlador recebidos e decodificados!");
          }
          xSemaphoreGive(dataMutex);
        }
      }
    }
    vTaskDelay(1 / portTICK_PERIOD_MS); // 1ms delay
  }
}

// ------------------------------------------------------------------
// --- TAREFA PARA PROCESSAMENTO WEB ---
// ------------------------------------------------------------------
void webTask(void *pvParameters) {
  while (true) {
    server.handleClient();
    vTaskDelay(10 / portTICK_PERIOD_MS); // 10ms delay
  }
}

// ------------------------------------------------------------------
// --- FUNÇÃO DE CONFIGURAÇÃO (SETUP) ---
// ------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Serial.println("--- Leitor/Sniffer CAN ESP32 (TJA1050) - Versão Final com Tasks ---");
  
  // Inicializa mutex
  dataMutex = xSemaphoreCreateMutex();
  if (dataMutex == NULL) {
    Serial.println("ERRO: Falha ao criar mutex!");
    return;
  }
  
  // Configuração CAN
  ESP32Can.setPins(CAN_TX_PIN, CAN_RX_PIN);
  if (ESP32Can.begin(CAN_SPEED)) {
    Serial.println("Controlador CAN (TWAI) iniciado com sucesso!");
    Serial.println("Monitorando em 250 kbps nos pinos TX:5 e RX:4...");
  } else {
    Serial.println("ERRO: Falha ao iniciar o controlador CAN! Verifique as conexões.");
    while (1) delay(100);
  }

  // Conexão Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Conectado ao Wi-Fi!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Configuração WebServer
  server.on("/", HTTP_GET, []() {
    String html = R"=====(
<!DOCTYPE html>
<html>
<head>
    <title>Dados CAN</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f0f0f0; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .section h2 { margin-top: 0; color: #333; }
        .data-item { margin: 10px 0; }
        .label { display: inline-block; width: 200px; font-weight: bold; }
        .value { color: #007acc; }
        button { padding: 10px 20px; background-color: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background-color: #005a99; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Dados CAN em Tempo Real</h1>
        
        <div class="section">
            <h2>Bateria (ID: 0x120)</h2>
            <div class="data-item"><span class="label">Corrente (A):</span> <span id="current" class="value">--</span></div>
            <div class="data-item"><span class="label">Voltagem (V):</span> <span id="voltage" class="value">--</span></div>
            <div class="data-item"><span class="label">SoC (%):</span> <span id="soc" class="value">--</span></div>
            <div class="data-item"><span class="label">SoH (%):</span> <span id="soh" class="value">--</span></div>
            <div class="data-item"><span class="label">Temperatura (°C):</span> <span id="temperature" class="value">--</span></div>
        </div>
        
        <div class="section">
            <h2>Motor/Controlador (ID: 0x300)</h2>
            <div class="data-item"><span class="label">RPM do Motor:</span> <span id="motorSpeed" class="value">--</span></div>
            <div class="data-item"><span class="label">Torque (Nm):</span> <span id="torque" class="value">--</span></div>
            <div class="data-item"><span class="label">Temp. Motor (°C):</span> <span id="motorTemp" class="value">--</span></div>
            <div class="data-item"><span class="label">Temp. Controlador (°C):</span> <span id="controllerTemp" class="value">--</span></div>
        </div>
        
        <button onclick="location.reload()">Atualizar</button>
    </div>
    
    <script>
        function fetchData() {
            fetch('/api/data')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('current').textContent = data.battery.current;
                    document.getElementById('voltage').textContent = data.battery.voltage;
                    document.getElementById('soc').textContent = data.battery.soc;
                    document.getElementById('soh').textContent = data.battery.soh;
                    document.getElementById('temperature').textContent = data.battery.temperature;
                    
                    document.getElementById('motorSpeed').textContent = data.motorController.motorSpeedRpm;
                    document.getElementById('torque').textContent = data.motorController.motorTorque;
                    document.getElementById('motorTemp').textContent = data.motorController.motorTemperature;
                    document.getElementById('controllerTemp').textContent = data.motorController.controllerTemperature;
                })
                .catch(error => console.error('Erro:', error));
        }
        
        // Atualiza a cada 1 segundo
        setInterval(fetchData, 1000);
        fetchData(); // Primeira atualização
    </script>
</body>
</html>
)=====";
    server.send(200, "text/html", html);
  });

  server.on("/api/data", HTTP_GET, []() {
    // Protege acesso às variáveis de dados
    if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
      DynamicJsonDocument doc(1024);
      JsonObject batteryObj = doc.createNestedObject("battery");
      batteryObj["current"] = battery.current;
      batteryObj["voltage"] = battery.voltage;
      batteryObj["soc"] = battery.soc;
      batteryObj["soh"] = battery.soh;
      batteryObj["temperature"] = battery.temperature;

      JsonObject motorControllerObj = doc.createNestedObject("motorController");
      motorControllerObj["motorSpeedRpm"] = motorController.motorSpeedRpm;
      motorControllerObj["motorTorque"] = motorController.motorTorque;
      motorControllerObj["motorTemperature"] = motorController.motorTemperature;
      motorControllerObj["controllerTemperature"] = motorController.controllerTemperature;

      String jsonString;
      serializeJson(doc, jsonString);
      server.send(200, "application/json", jsonString);
      
      xSemaphoreGive(dataMutex);
    } else {
      server.send(500, "text/plain", "Erro de sincronização");
    }
  });

  server.begin();
  Serial.println("WebServer iniciado!");

  // Cria as tasks
  xTaskCreate(canTask, "CAN Task", 4096, NULL, 1, NULL);
  xTaskCreate(webTask, "Web Task", 8192, NULL, 1, NULL);
  
  Serial.println("Tasks criadas com sucesso!");
}

// ------------------------------------------------------------------
// --- LOOP PRINCIPAL ---
// ------------------------------------------------------------------
void loop() {
  // O loop principal agora está vazio pois as tarefas estão rodando
  vTaskDelay(1000 / portTICK_PERIOD_MS); // 1 segundo delay
}