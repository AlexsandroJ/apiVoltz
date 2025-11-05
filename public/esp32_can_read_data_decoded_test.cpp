#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32CAN.h>  // Biblioteca ESP32CAN (https://github.com/miwagner/ESP32CAN)

// Substitua pelos seus dados de WiFi
const char* ssid = "CINGUESTS";
const char* password = "acessocin";

// IDs base
#define BASE_BATTERY_ID     0x120
#define BASE_CONTROLLER_ID  0x300

// Estruturas para armazenar dados
struct BatteryData {
    float voltage = 0.0;
    float current = 0.0;
    uint8_t SoC = 0;
    uint8_t SoH = 0;
    uint8_t temperature = 0;
};

struct MotorData {
    uint16_t motorSpeedRPM = 0;
    float motorTorque = 0.0;
    int8_t motorTemperature = 0;
    int8_t controllerTemperature = 0;
};

// Variáveis globais
BatteryData battery;
MotorData motor;
bool batteryUpdated = false;
bool motorUpdated = false;

// Servidor web
WebServer server(80);

// Configuração CAN
CAN_device_t CAN_cfg;
CAN_message_t rx_frame;

void setup() {
    Serial.begin(115200);
    delay(1000);

    // Conecta ao Wi-Fi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi conectado. IP: " + WiFi.localIP().toString());

    // Configura CAN
    CAN_cfg.speed = CAN_SPEED_250KBPS;
    CAN_cfg.tx_pin_id = GPIO_NUM_5;
    CAN_cfg.rx_pin_id = GPIO_NUM_4;
    CAN_init();

    // Inicia servidor web
    server.on("/", HTTP_GET, []() {
        String html = "<!DOCTYPE html><html><head>";
        html += "<meta charset='UTF-8'>";
        html += "<meta http-equiv='refresh' content='1'>";
        html += "<title>Dados CAN - BMS & Motor</title>";
        html += "<style>body{font-family:Arial; padding:20px;}</style>";
        html += "</head><body>";
        html += "<h2>Dados CAN em Tempo Real</h2>";

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
        server.send(200, "text/html", html);
    });

    server.begin();
    Serial.println("Servidor web iniciado.");
}

void loop() {
    // Lê mensagem CAN
    if (CAN_read_message(&rx_frame) == 0) { // sucesso
        uint32_t packetID = rx_frame.MsgID;
        uint8_t* packetData = rx_frame.buf;

        if (rx_frame.FIR.B.RTR == 0) { // Não é requisição remota (RTR)
            if (packetID == BASE_BATTERY_ID) {
                battery.voltage = (packetData[0] * 256 + packetData[1]) * 0.1;
                battery.current = (packetData[2] * 256 + packetData[3]) * 0.1;
                battery.SoC = packetData[6];
                battery.SoH = packetData[7];
                battery.temperature = packetData[4];
                batteryUpdated = true;
                Serial.println("Recebido: BMS (0x120)");
            }
            else if (packetID == BASE_CONTROLLER_ID) {
                motor.motorSpeedRPM = packetData[0] * 256 + packetData[1];
                motor.motorTorque = (packetData[2] * 256 + packetData[3]) * 0.1;
                motor.motorTemperature = packetData[7] - 40;
                motor.controllerTemperature = packetData[6] - 40;
                motorUpdated = true;
                Serial.println("Recebido: Motor (0x300)");
            }
        }
    }

    // Atende requisições web
    server.handleClient();
}