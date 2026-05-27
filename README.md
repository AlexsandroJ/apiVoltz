# 🔋 MoDCS - Sistema de Telemetria para Moto Elétrica

![Dashboard Preview](/public/img/dashboard.png)

> **API + Dashboard em tempo real para monitoramento da moto elétrica MoDCS**  
> Solução completa para leitura, processamento e visualização de dados telemétricos via rede CAN e MQTT.

---

## 🚀 Visão Geral

O **MoDCS Telemetry** é um sistema full-stack que combina uma **API RESTful** com um **dashboard web interativo** para monitorar em tempo real os parâmetros críticos da moto elétrica **Voltz**. O ESP32 coleta dados da rede CAN e os envia via **MQTT** para a API, que processa, armazena no MongoDB e disponibiliza para o dashboard via WebSocket/REST.

Ideal para: testes de campo, desenvolvimento de firmware, manutenção preditiva e análise de dados de veículos elétricos.

---

## 📦 Funcionalidades

✅ **Dashboard Web Interativo**
- Velocidade atual (km/h)  
- Nível de bateria (%) e SoC (State of Charge)  
- Autonomia estimada (km)  
- Temperatura da bateria e do motor (°C)  
- Modo de condução (Eco, Normal, Sport)  
- Potência instantânea (kW)  
- Mapa de localização em tempo real (OpenStreetMap + Leaflet)  
- Log de mensagens CAN (ID, dados brutos, timestamp)  
- Exportação de dados em CSV

✅ **API RESTful + WebSocket**
- Endpoints para acesso estruturado aos dados do veículo  
- Recebe frames CAN via **MQTT** (tópico: `moto/telemetria`)  
- Respostas em JSON padronizado  
- Suporte a modo simulação (mock data)  
- Segurança com API Key e CORS configurável  
- Documentação com Swagger/OpenAPI

✅ **Integração CAN + MQTT + ESP32**
- Leitura e decodificação de mensagens CAN 2.0B no ESP32  
- Mapeamento de IDs para sinais físicos (velocidade, voltagem, corrente, temperatura)  
- Envio assíncrono via MQTT para o broker  
- Reconexão automática e tratamento de erros no cliente MQTT

---

## 🛠️ Tecnologias Utilizadas

| Camada        | Tecnologia                                |
|---------------|------------------------------------------ |
| Frontend      | HTML5, CSS3, JavaScript                   |
| Backend       | Node.js + Express + MongoDB               |
| Comunicação   | REST API + WebSocket + MQTT               |
| Telemetria    | Rede CAN 2.0B + ESP32 + FreeRTOS          |
| Mapas         | OpenStreetMap + Leaflet.js                |
| Documentação  | Swagger (OpenAPI 3.0)                     |
| Testes        | Jest + Supertest + mongodb-memory-server  |
| Deploy        | Kubernetes (K3s) + Docker                 |

---

## 📁 Estrutura do Projeto
```
apiVoltz/
    ├── sketch_def/
    │   └── sketch_def.ino          # FreeRTOS
```
# Guia de Instalação e Conexão MQTT — apiVoltz

> Este guia explica passo a passo como instalar o **Mosquitto MQTT Broker**, configurar o arquivo `.env` da API e estabelecer a conexão entre a API Node.js e o broker MQTT para telemetria da moto elétrica Voltz.


## 🦟 O que é o Mosquitto?

**Eclipse Mosquitto** é um broker MQTT open-source leve e de alta performance, ideal para IoT e telemetria em tempo real. Ele atua como intermediário entre dispositivos (ESP32) e a API, recebendo mensagens publicadas e entregando aos assinantes.

---

## 🔧 Etapa 1 — Instalação do Mosquitto

### Linux (Ubuntu/Debian)

```bash
# Atualizar repositórios
sudo apt-get update

# Instalar Mosquitto e clientes
sudo apt-get install -y mosquitto mosquitto-clients

# Iniciar serviço
sudo systemctl start mosquitto
sudo systemctl enable mosquitto

# Verificar status
sudo systemctl status mosquitto
```

### macOS (Homebrew)

```bash
# Instalar
brew install mosquitto

# Iniciar serviço
brew services start mosquitto

# Verificar status
brew services list | grep mosquitto
```

### Windows

1. Baixe o instalador em: [https://mosquitto.org/download/](https://mosquitto.org/download/)
2. Execute o instalador `.exe` e siga as instruções
3. O serviço será instalado automaticamente e iniciado na porta **1883**
4. Verifique no *Services* (services.msc) se o "Mosquitto Broker" está rodando

---

## ⚙️ Etapa 2 — Configuração do Broker Mosquitto

### Arquivo de Configuração

Local padrão do arquivo de configuração:
- **Linux**: `/etc/mosquitto/mosquitto.conf`
- **macOS**: `/opt/homebrew/etc/mosquitto/mosquitto.conf` (Apple Silicon) ou `/usr/local/etc/mosquitto/mosquitto.conf` (Intel)
- **Windows**: `C:\Program Files\mosquitto\mosquitto.conf`

### Configuração Básica (sem autenticação — apenas para desenvolvimento)

Edite o arquivo `mosquitto.conf`:

```conf
# Porta padrão MQTT
listener 1883

# Permitir conexões anônimas (apenas DEV!)
allow_anonymous true

# Log
log_dest file /var/log/mosquitto/mosquitto.log
log_type all

# Persistência
persistence true
persistence_location /var/lib/mosquitto/
```

## 🔌 Etapa 3 — Conectar o ESP32 (Firmware) Codigo em:

```
apiVoltz/
    ├── sketch_def/
    │   └── sketch_def.ino          # FreeRTOS
```

## 🔧 Como Baixar e Executar o Projeto

## 1 Instalar Git

Windows:
Acesse o site oficial do [Git](https://git-scm.com)

Baixe o instalador para Windows.

Execute o instalador e siga as instruções na tela, mantendo as configurações padrão recomendadas.

macOS:
Você pode instalar o Git usando o Homebrew.

Terminal
```
brew install git
```
Linux:
No Ubuntu ou distribuições baseadas em Debian:

Terminal
```
sudo apt-get update
sudo apt-get install git
```

## 2. Instalar Node.jse npm
Node.js é um ambiente de execução de JavaScript, e npm (Node Package Manager) é o gerenciador de pacotes padrão para Node.js, usado para instalar bibliotecas e ferramentas de desenvolvimento.

Windows e macOS:
Acesse o site oficial do [Node.js](https://nodejs.org)

Baixe o instalador para o seu sistema operacional (recomendo a versão LTS).

Execute o instalador e siga as instruções na tela, mantendo as configurações padrão recomendadas.

Linux:
No Ubuntu ou distribuições baseadas em Debian:

Terminal
```
sudo apt-get update
sudo apt-get install -y nodejs
sudo apt-get install -y npm
```
Terminal
```
sudo dnf install nodejs
sudo dnf install npm
```
## 3. Clonar o Repositório do Projeto
Usando o Git, você pode clonar o repositório do seu projeto para obter uma cópia local.

Terminal
```
git clone https://github.com/AlexsandroJ/apiVoltz.git
```
## 4. Navegar até o Diretório do Projeto
Depois de clonar o repositório, navegue até o diretório do projeto.

Terminal
```
cd apiVoltz
```
## 5. Instalar as Dependências do Projeto
Use o npm para instalar todas as dependências listadas no arquivo package.json do projeto.

Terminal
```
npm install
```

## 6. Configuração do .env da API

No diretório raiz do projeto `apiVoltz`, crie o arquivo `.env` baseado no `.env.example`:

```bash
cp env.example .env
```

## 7. Executar o Projeto
Uma vez que as dependências estejam instaladas, você pode Executar o projeto.

Terminal
```
npm run dev
```

📌 A API é documentada com **Swagger (OpenAPI)**. Após iniciar o servidor, acesse:  
👉 `http://localhost:3000/api-docs` em desenvolvimento