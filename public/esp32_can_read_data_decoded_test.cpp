// Inclusão de bibliotecas essenciais:
// - Arduino.h: Biblioteca base do Arduino
// - WiFi.h e WebServer.h: Para funcionalidades WiFi e servidor web
// - ESP32CAN.h: Para comunicação CAN no ESP32
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32CAN.h>  // Biblioteca ESP32CAN (https://github.com/miwagner/ESP32CAN)

// Credenciais de rede WiFi
const char* ssid = "CINGUESTS";      // Nome da rede WiFi
const char* password = "acessocin";  // Senha da rede WiFi

// IDs base dos frames CAN para identificação de BMS e Controlador de Motor
#define BASE_BATTERY_ID     0x120  // ID base para dados da bateria (BMS)
#define BASE_CONTROLLER_ID  0x300  // ID base para dados do motor/controlador

// Estrutura para armazenar os dados recebidos do BMS (Battery Management System)
struct BatteryData {
    float voltage = 0.0;      // Tensão da bateria em Volts
    float current = 0.0;      // Corrente em Amperes (positiva = carga, negativa = descarga)
    uint8_t SoC = 0;          // State of Charge - Nível de carga em %
    uint8_t SoH = 0;          // State of Health - Nível de saúde em %
    uint8_t temperature = 0;  // Temperatura da bateria em °C
};

// Estrutura para armazenar os dados recebidos do controlador do motor
struct MotorData {
    uint16_t motorSpeedRPM = 0;       // RPM do motor
    float motorTorque = 0.0;          // Torque do motor em Nm
    int8_t motorTemperature = 0;      // Temperatura do motor em °C
    int8_t controllerTemperature = 0; // Temperatura do controlador em °C
};

// Variáveis globais para armazenar os dados e controle de atualização
BatteryData battery;
MotorData motor;
bool batteryUpdated = false; // Flag para saber se os dados da bateria foram atualizados
bool motorUpdated = false;   // Flag para saber se os dados do motor foram atualizados

// Servidor web na porta 80 (padrão HTTP)
WebServer server(80);

// Configurações da comunicação CAN
CAN_device_t CAN_cfg; // Configurações do barramento CAN
CAN_message_t rx_frame; // Estrutura para armazenar a mensagem CAN recebida

void setup() {
    Serial.begin(115200); // Inicializa a comunicação serial para debug
    delay(1000);

    // Conecta ao WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print("."); // Imprime ponto enquanto tenta conectar
    }
    Serial.println("\nWiFi conectado. IP: " + WiFi.localIP().toString()); // Imprime o IP atribuído

    // Configuração da interface CAN
    CAN_cfg.speed = CAN_SPEED_250KBPS; // Define a velocidade do barramento CAN
    CAN_cfg.tx_pin_id = GPIO_NUM_5;    // Pino TX CAN
    CAN_cfg.rx_pin_id = GPIO_NUM_4;    // Pino RX CAN
    CAN_init(); // Inicializa a interface CAN

    // Configuração do servidor web
    server.on("/", HTTP_GET, []() { // Define a rota raiz "/"
        // Cria a página HTML a ser enviada
        String html = "<!DOCTYPE html><html><head>";
        html += "<meta charset='UTF-8'>";
        html += "<meta http-equiv='refresh' content='1'>"; // Atualiza a página a cada 1 segundo
        html += "<title>Dados CAN - BMS & Motor</title>";
        html += "<style>body{font-family:Arial; padding:20px;}</style>"; // Estilo CSS simples
        html += "</head><body>";
        html += "<h2>Dados CAN em Tempo Real</h2>";

        // Exibe os dados da bateria, se tiver sido atualizado recentemente
        if (batteryUpdated) {
            html += "<h3>Bateria (ID 0x120)</h3>";
            html += "Tensão: " + String(battery.voltage, 1) + " V<br>";
            html += "Corrente: " + String(battery.current, 1) + " A<br>";
            html += "SoC: " + String(battery.SoC) + " %<br>";
            html += "SoH: " + String(battery.SoH) + " %<br>";
            html += "Temp: " + String(battery.temperature) + " °C<br><br>";
        } else {
            html += "<h3>Bateria: Sem dados recentes</h3><br>";
        }

        // Exibe os dados do motor, se tiver sido atualizado recentemente
        if (motorUpdated) {
            html += "<h3>Motor (ID 0x300)</h3>";
            html += "RPM: " + String(motor.motorSpeedRPM) + " rpm<br>";
            html += "Torque: " + String(motor.motorTorque, 1) + " Nm<br>";
            html += "Temp Motor: " + String(motor.motorTemperature) + " °C<br>";
            html += "Temp Controlador: " + String(motor.controllerTemperature) + " °C<br>";
        } else {
            html += "<h3>Motor: Sem dados recentes</h3><br>";
        }

        html += "</body></html>";
        server.send(200, "text/html", html); // Envia a resposta HTTP com a página HTML
    });

    server.begin(); // Inicia o servidor web
    Serial.println("Servidor web iniciado.");
}

void loop() {
    // Lê uma mensagem CAN recebida
    if (CAN_read_message(&rx_frame) == 0) { // 0 indica sucesso na leitura
        uint32_t packetID = rx_frame.MsgID; // Obtém o ID da mensagem CAN
        uint8_t* packetData = rx_frame.buf; // Obtém o buffer de dados da mensagem

        // Verifica se não é uma mensagem de solicitação remota (RTR)
        if (rx_frame.FIR.B.RTR == 0) {
            // Verifica se é um frame de dados da bateria (ID 0x120)
            if (packetID == BASE_BATTERY_ID) {
                // Decodifica os dados do frame CAN para a estrutura BatteryData
                // Exemplo: tensão em bytes 0 e 1, corrente em 2 e 3, etc.
                // Os dados são interpretados como big-endian e convertidos para valores reais
                battery.voltage = (packetData[0] * 256 + packetData[1]) * 0.1; // Valor em 0.1V
                battery.current = (packetData[2] * 256 + packetData[3]) * 0.1; // Valor em 0.1A
                battery.temperature = packetData[4]; // Temperatura em °C
                battery.SoC = packetData[6]; // Porcentagem
                battery.SoH = packetData[7]; // Porcentagem
                batteryUpdated = true; // Marca que os dados da bateria foram atualizados
                Serial.println("Recebido: BMS (0x120)"); // Mensagem de debug
            }
            // Verifica se é um frame de dados do motor (ID 0x300)
            else if (packetID == BASE_CONTROLLER_ID) {
                // Decodifica os dados do frame CAN para a estrutura MotorData
                motor.motorSpeedRPM = packetData[0] * 256 + packetData[1]; // RPM em 1 RPM
                motor.motorTorque = (packetData[2] * 256 + packetData[3]) * 0.1; // Torque em 0.1 Nm
                motor.controllerTemperature = packetData[6] - 40; // Temperatura em °C, com offset de 40
                motor.motorTemperature = packetData[7] - 40; // Temperatura em °C, com offset de 40
                motorUpdated = true; // Marca que os dados do motor foram atualizados
                Serial.println("Recebido: Motor (0x300)"); // Mensagem de debug
            }
        }
    }

    // Processa requisições pendentes do servidor web
    server.handleClient();
}