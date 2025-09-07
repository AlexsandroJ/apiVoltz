# 🔋 Voltz - Sistema de Telemetria para Moto Elétrica

![Dashboard Preview](/src/img/dashboard.png)

> **API + Dashboard em tempo real para monitoramento da moto elétrica Voltz**  
> Solução completa para leitura, processamento e visualização de dados telemétricos via rede CAN.

---

## 🚀 Visão Geral

O **Voltz Telemetry** é um sistema full-stack que combina uma **API RESTful** com um **dashboard web interativo** para monitorar em tempo real os parâmetros críticos da moto elétrica da **Voltz**. O projeto foi desenvolvido para permitir o acompanhamento de desempenho, estado da bateria, localização e mensagens da rede CAN, sendo ideal para testes de campo, desenvolvimento de firmware, manutenção e análise de dados.

---

## 📦 Funcionalidades

✅ **Dashboard Web Interativo**
- Velocidade atual (km/h)  
- Nível de bateria (%) e SoC (State of Charge)  
- Autonomia estimada (km)  
- Temperatura da bateria (°C)  
- Modo de condução (Eco, Normal, Sport)  
- Potência instantânea (kW)  
- Mapa de localização em tempo real (OpenStreetMap + Leaflet)  
- Log de mensagens CAN (ID, dados brutos, timestamp)

✅ **API RESTful**
- Endpoints para acesso estruturado aos dados do veículo  
- Recebe e processa frames CAN (via WebSocket ou POST)  
- Respostas em JSON padronizado  
- Suporte a modo simulação (mock data)  
- Segurança opcional com API Key

✅ **Integração com Rede CAN**
- Leitura e decodificação de mensagens CAN 2.0B  
- Mapeamento de IDs para sinais (ex: velocidade, voltagem, corrente)  
- Conversão de dados brutos para valores físicos

---

## 🛠️ Tecnologias Utilizadas

| Camada      | Tecnologia                         |
|-------------|-------------------------------------|
| Frontend    | HTML, CSS, JavaScript               |
| Backend     | Node.js + Mongo + Express           |
| Comunicação | REST API + WebSocket (opcional)     |
| Mapas       | OpenStreetMap                       |
| Deploy      | Kubernets (K3s)                     |

---

## 📁 Estrutura do Projeto
