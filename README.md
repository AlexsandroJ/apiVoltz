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
-- Em desenvolvimento

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