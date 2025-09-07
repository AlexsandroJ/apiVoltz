#include <WiFi.h>
#include <HTTPClient.h>

// ============== CONFIGURAÇÕES ==============
String ssid = "Wokwi-GUEST";
String password = "";

String url = "https://587df0485545-10-244-6-156-30306.saci.r.killercoda.com/api";

// Intervalo entre envios (1 segundos)
const long sendInterval = 1000;

// ============== Estrutura de dados CAN ==============
struct CanMessage
{
  String id;
  int dlc;
  String data;
};

// Auxiliar para contagem de repetições
int sendCount = 0;

// Tamanho máximo do buffer de mensagens CAN
const int CAN_BUFFER_SIZE = 100;    // Fila suporta até 100 mensagens
const int CAN_BUFFER_AUX_SIZE = 10; // Fila suporta até 10 mensagens para enviar
const int SEND_THRESHOLD = 10;      // Enviar a cada 10 mensagens

// ============== Variáveis compartilhadas ==============
CanMessage lastCanMessage;
CanMessage buffer[10];    // Buffer local
CanMessage bufferAux[10]; // Buffer Auxiliar

SemaphoreHandle_t canMutex; // Protege o acesso à variável buffer

QueueHandle_t canQueue; // Fila para armazenar mensagens CAN

SemaphoreHandle_t bufferReady; // Sinaliza buffer Pronto para envio

int messageCount = 0; // Contador de mensagens CAN recebidas

uint32_t count = 0; // Contador de mensagens na fila

// ============== Protótipo da Task ==============
void telemetriaTask(void *parameter);
void canReaderTask(void *parameter);

// ============== SETUP ==============
void setup()
{
  Serial.begin(115200);
  delay(100);

  // Cria uma fila (buffer) para armazenar mensagens CAN
  canQueue = xQueueCreate(CAN_BUFFER_SIZE, sizeof(CanMessage));
  if (canQueue == NULL)
  {
    Serial.println("❌ Falha ao criar fila CAN");
    while (1)
      delay(10);
  }

  // Inicializa mutex para proteger o acesso ao dado CAN
  canMutex = xSemaphoreCreateMutex();
  if (canMutex == NULL)
  {
    Serial.println("❌ Falha ao criar mutex para CAN");
    while (1)
      delay(10);
  }

  // Cria semáforo de sinalização
  bufferReady = xSemaphoreCreateBinary();
  if (bufferReady == NULL)
  {
    Serial.println("❌ Falha ao criar semáforo de buffer cheio");
    while (1)
      delay(10);
  }
  // Cria a task CAN no NÚCLEO 0
  xTaskCreatePinnedToCore(
      canReaderTask,
      "CAN_Reader",
      2048,
      NULL,
      2, // Prioridade maior que telemetria
      NULL,
      0 // Núcleo 0
  );

  // Cria a tarefa de telemetria no núcleo 1
  xTaskCreatePinnedToCore(
      telemetriaTask,   // Função da tarefa
      "TelemetriaTask", // Nome amigável
      10000,            // Tamanho da pilha (grande para HTTP)
      NULL,             // Parâmetros
      1,                // Prioridade
      NULL,             // Handle (não usado)
      1                 // Núcleo 1 (deixe o núcleo 0 livre)
  );
}

// ============== LOOP ==============
void loop()
{
  // Pode ficar vazio ou rodar outras tarefas leves
  delay(1); // Necessário para evitar bloqueio
}

// ============== TASK 1: Simulação de Leitura CAN ==============
void canReaderTask(void *parameter)
{
  (void)parameter;
  int messageCounter = 0;

  for (;;)
  {
    // Simula uma nova mensagem CAN a cada 2 segundos
    vTaskDelay(2000 / portTICK_PERIOD_MS);

    // Novos dados simulados (ex: ID 0x540, velocidade, temperatura)
    String simulatedData;
    if (messageCounter % 2 == 0)
    {
      simulatedData = "00FF00FF"; // speed = 48 km/h
    }
    else
    {
      simulatedData = "FF00FF00"; // outro dado qualquer
    }

    // Cria mensagem simulada
    CanMessage newMsg = {
        .id = "0x666",
        .dlc = 8,
        .data = simulatedData};

    // Tenta adicionar na fila (não bloqueante)
    if (xQueueSendToBack(canQueue, &newMsg, 100 / portTICK_PERIOD_MS) != pdTRUE)
    {
      Serial.println("⚠️ Buffer CAN cheio! Mensagem perdida.");
    }
    else
    {
      // Se atingiu múltiplo de 10, sinaliza
      if (count % SEND_THRESHOLD == 0 && count != 0)
      {
        Serial.printf("🔔 %d mensagens armazenadas! Avisando para enviar...\n", count);
        int sentCount = 0;

        // Protege a escrita com mutex
        if (xSemaphoreTake(canMutex, 100 / portTICK_PERIOD_MS))
        {
          // Lê até 10 mensagens da fila → elas são REMOVIDAS automaticamente
          while (sentCount < 10 && xQueueReceive(canQueue, &newMsg, 0) == pdTRUE)
          {
            buffer[sentCount++] = newMsg;
          }
          // Sinaliza que há 10 mensagens para enviar
          xSemaphoreGive(bufferReady);
          xSemaphoreGive(canMutex);
        }
      }
      count = uxQueueMessagesWaiting(canQueue);
      Serial.printf("%d 📨 CAN armazenado: ID=%s DLC=%d\n", count, newMsg.id.c_str(), newMsg.dlc);
    }
  }
}
// ============== TASK 2: Envio de Telemetria ==============
void telemetriaTask(void *parameter)
{

  (void)parameter; // Ignora parâmetro não usado
  Serial.println("Conectando ao Wi-Fi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("✅ Conectado ao Wi-Fi!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  unsigned long lastSend = 0;

  for (;;)
  { // Loop infinito da tarefa
    unsigned long currentMillis = millis();

    if (xSemaphoreTake(bufferReady, 100 / portTICK_PERIOD_MS) == pdTRUE)
    {
      Serial.println("🚀 Sinal recebido! Enviando 10 mensagens...");

      // Protege a escrita com mutex
      if (xSemaphoreTake(canMutex, 10 / portTICK_PERIOD_MS))
      {
        for (int i = 0; i < 10; i++)
        {
          bufferAux[i] = buffer[i];
        }
        xSemaphoreGive(canMutex);
      }
      // Verifica conexão Wi-Fi
      if (WiFi.status() != WL_CONNECTED)
      {
        Serial.println("❌ Wi-Fi desconectado. Tentando reconectar...");
        WiFi.reconnect();
        delay(2000);
        if (WiFi.status() != WL_CONNECTED)
        {
          continue;
        }
      }

      HTTPClient http;
      http.setTimeout(10000); // Timeout de 10 segundos

      // Tenta iniciar conexão
      if (!http.begin(url))
      {
        Serial.println("❌ Falha ao iniciar HTTP. URL inválida?");
        continue;
      }
      // Lê a última mensagem CAN (com mutex)
      CanMessage currentCan;
      bool canValid = false;
      if (xSemaphoreTake(canMutex, 100 / portTICK_PERIOD_MS))
      {
        currentCan = lastCanMessage;
        canValid = true;
        xSemaphoreGive(canMutex);
      }

      http.addHeader("Content-Type", "application/json");

      String jsonData = "{";
      jsonData += "\"speed\": 48,";
      jsonData += "\"battery\": {\"soc\": 76, \"soh\": 94, \"voltage\": 71.8, \"current\": -3.4, \"temperature\": 31.2},";
      jsonData += "\"motor\": {\"rpm\": 3600, \"power\": 9.8, \"regenLevel\": 40, \"motorTemp\": 68, \"inverterTemp\": 61},";
      jsonData += "\"location\": {\"type\": \"Point\", \"coordinates\": [-45.6333, -23.5500]},";
      jsonData += "\"driveMode\": \"sport\",";
      jsonData += "\"range\": 74,";
      jsonData += "\"vehicleStatus\": \"ligado\",";
      jsonData += "\"odometer\": 1247.3,";
      jsonData += "\"alerts\": [{";
      jsonData += "  \"code\": \"MOTOR_OVERHEAT_WARNING\",";
      jsonData += "  \"message\": \"Temperatura do motor acima de 65°C\",";
      jsonData += "  \"severity\": \"warning\"";
      jsonData += "}],";
      jsonData += "\"canMessages\": [";

      int msgCount = 10;

      for (int i = 0; i < msgCount; i++)
      {
        jsonData += "{";
        jsonData += "\"canId\": \"" + bufferAux[i].id + "\",";
        jsonData += "\"data\": \"" + bufferAux[i].data + "\",";
        jsonData += "\"dlc\": " + String(bufferAux[i].dlc); // ✅ Sem vírgula aqui
        jsonData += "}";                                    // Fecha o objeto

        if (i < msgCount - 1)
        {
          jsonData += ","; // ✅ Vírgula entre objetos do array
        }
      }

      jsonData += "]"; // Fecha o array canMessages
      jsonData += "}"; // Fecha o JSON principal
      sendCount++;
      Serial.printf("%d  📤 Enviando telemetria...\n", sendCount);
      int httpResponseCode = http.POST(jsonData);

      if (httpResponseCode > 0)
      {
        if (httpResponseCode == 200 || httpResponseCode == 201)
        {
          Serial.printf("✅ Código HTTP: %d\n", httpResponseCode);
        }
        else
        {
          Serial.printf("❌ Código HTTP: %d\n", httpResponseCode);
        }
      }
      else
      {
        Serial.printf("❌ Falha na requisição. Código: %d\n", httpResponseCode);
        Serial.println("🔧 Verifique URL, conexão ou servidor.");
      }

      http.end(); // Sempre encerre a conexão
    }

    // ⏱️ Libera o núcleo por 10ms (evita travar o FreeRTOS)
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}