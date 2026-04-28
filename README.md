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

| Camada      | Tecnologia                          |
|-------------|-------------------------------------|
| Frontend    | HTML, CSS, JavaScript               |
| Backend     | Node.js + Mongo + Express           |
| Comunicação | REST API + WebSocket                |
| Mapas       | OpenStreetMap                       |
| Deploy      | Kubernets (K3s)                     |

---

## 📁 Estrutura do Projeto
apiVoltz/
├── 📄 app.js                      # Arquivo principal de configuração da aplicação Express
│                                  # - Configura middleware, rotas e serviços
│                                  # - Centraliza a inicialização do servidor
│
├── 📄 server.js                   # Ponto de entrada do servidor
│                                  # - Inicia o servidor HTTP/HTTPS
│                                  # - Configura listeners e tratamento de erros
│
├── 📄 package.json                # Manifesto do projeto Node.js
│                                  # - Dependências, scripts e metadados
│
├── 📄 package-lock.json           # Lockfile para garantir instalação consistente de deps
│
├── 📄 jest.config.js              # Configuração do framework de testes Jest
│
├── 📄 .gitignore                  # Arquivos e pastas ignorados pelo Git
│
├── 📄 example_env                 # Exemplo de variáveis de ambiente (.env.example)
│                                  # - Serve como template para configuração local
│
├── 📄 README.md                   # Documentação principal do projeto
│
│
├── 📂 config/                     # Configurações globais e constantes do sistema
│   ├── 📄 constants.js            # Constantes JavaScript para o backend
│   │                              # - IDs CAN, limites, parâmetros de telemetria
│   └── 📄 constants_example.h     # Template de constantes para firmware ESP32 (C++)
│                                  # - Usado como referência para compilação no microcontrolador
│
│
├── 📂 controllers/                # Lógica de negócio e handlers das requisições
│   ├── 📄 canController.js        # Processamento de mensagens CAN
│   │                              # - Decodificação de frames, conversão para valores físicos
│   │                              # - Validação e formatação de dados telemétricos
│   └── 📄 currentLocationController.js  # Gerenciamento de localização GPS
│                                  # - Atualização e consulta de coordenadas em tempo real
│
│
├── 📂 database/                   # Camada de persistência de dados
│   ├── 📄 (arquivos de conexão e schemas)
│                                  # - Configuração do MongoDB/Mongoose
│                                  # - Definição de modelos de dados (Veículo, Telemetria, etc.)
│
│
├── 📂 models/                     # Definição de schemas e estruturas de dados
│   ├── 📄 (ex: Vehicle.js, Telemetry.js, etc.)
│                                  # - Modelos Mongoose para persistência no MongoDB
│                                  # - Validação e tipos de dados da aplicação
│
│
├── 📂 mqtt/                       # Integração com protocolo MQTT para IoT
│   ├── 📄 (ex: mqttClient.js, topics.js)
│                                  # - Cliente MQTT para pub/sub de dados telemétricos
│                                  # - Tópicos para bateria, velocidade, GPS, etc.
│                                  # - Tratamento de reconexão e QoS
│
│
├── 📂 public/                     # Arquivos estáticos servidos pelo frontend
│   ├── 📄 index.html              # Página principal do dashboard
│   │                              # - Estrutura HTML com seções de métricas e mapa
│   ├── 📄 style.css               # Estilos globais e responsivos do dashboard
│   ├── 📂 js/                     # Scripts JavaScript do frontend
│   │   ├── 📄 (ex: dashboard.js, map.js, websocket.js)
│   │   │                          # - Atualização em tempo real via WebSocket
│   │   │                          # - Renderização de gráficos e mapa (Leaflet)
│   │   │                          # - Consumo da API REST para dados históricos
│   │   └── 📄 (outros módulos de UI)
│   └── 📂 img/                    # Recursos de imagem (ícones, logos, marcadores)
│
│
├── 📂 routes/                     # Definição das rotas da API RESTful
│   ├── 📄 canRoutes.js            # Rotas para operações relacionadas à rede CAN
│   │                              # - GET /api/can/messages - Listar mensagens
│   │                              # - POST /api/can/send - Enviar frame CAN (simulação)
│   │                              # - WebSocket endpoint para streaming de dados
│   └── 📄 (outras rotas: vehicle.js, telemetry.js, etc.)
│                                  # - Endpoints para veículo, bateria, localização
│
│
├── 📂 src/                        # Código-fonte de firmware e recursos embarcados
│   ├── 📂 esp32/                  # Código para microcontrolador ESP32
│   │   ├── 📄 (ex: main.cpp, can_task.cpp, mqtt_task.cpp)
│   │   │                          # - Implementação em C++/Arduino para ESP32
│   │   │                          # - Leitura CAN, envio MQTT, gerenciamento de tarefas FreeRTOS
│   │   └── 📄 platformio.ini      # Configuração do PlatformIO (se aplicável)
│   ├── 📂 sketch_def/             # Definições e headers auxiliares para sketches Arduino
│   ├── 📂 Manual/                 # Documentação técnica do hardware/firmware
│   └── 📂 img/                    # Recursos visuais para documentação embarcada
│
│
├── 📂 swagger/                    # Documentação da API com OpenAPI/Swagger
│   ├── 📄 swagger.json            # Especificação completa da API em JSON
│   ├── 📄 swagger.yaml            # Especificação completa da API em YAML
│   └── 📄 (arquivos auxiliares de documentação)
│                                  # - Acessível em /api-docs após iniciar o servidor
│
│
├── 📂 tests/                      # Suíte de testes automatizados
│   ├── 📂 unit/                   # Testes unitários de funções e módulos isolados
│   ├── 📂 integration/            # Testes de integração entre rotas, controllers e DB
│   ├── 📄 can.test.js             # Testes para decodificação e processamento CAN
│   ├── 📄 mqtt.test.js            # Testes para publicação/assinatura MQTT
│   └── 📄 (outros arquivos de teste)
│
│
└── 📂 utils/                      # Funções utilitárias reutilizáveis
    ├── 📄 canDecoder.js           # Lógica de decodificação de frames CAN brutos
    │                              # - Conversão de bytes para valores físicos (km/h, V, A)
    │                              # - Aplicação de fatores de escala e offset
    ├── 📄 timestamp.js            # Manipulação e formatação de timestamps
    ├── 📄 validators.js           # Funções de validação de entrada de dados
    └── 📄 (outras helpers: logger.js, errorHandler.js, etc.)

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
## 6. Executar o Projeto
Uma vez que as dependências estejam instaladas, você pode Executar o projeto.

Terminal
```
npm run dev
```

📌 A API é documentada com **Swagger (OpenAPI)**. Após iniciar o servidor, acesse:  
👉 `http://localhost:3000/api-docs` em desenvolvimento