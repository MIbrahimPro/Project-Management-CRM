# DevRolin CRM — Jitsi Meet Setup Guide

This guide details how to set up a self-hosted Jitsi Meet instance using Docker, optimized for integration with the DevRolin CRM (JWT-enabled for Lobby/Moderation control).

## 1. Local Setup (Windows via WSL2)

### Prerequisites
- Windows 10/11 with **WSL2** installed.
- **Docker Desktop** installed and **WSL Integration** enabled for your distro.

### Step-by-Step Installation
1.  **Clone the Jitsi Docker repo** inside your WSL terminal:
    ```bash
    git clone https://github.com/jitsi/docker-jitsi-meet
    cd docker-jitsi-meet
    ```
2.  **Create and configure .env**:
    ```bash
    cp env.example .env
    ./gen-passwords.sh
    ```
3.  **Configure Networking & JWT**:
    Edit the `.env` file and set/uncomment these variables:
    ```env
    # The domain you will use locally (usually localhost)
    PUBLIC_URL=https://localhost:8443
    
    # Ports (Jitsi default is 80/443, but 8443 is safer locally)
    HTTP_PORT=8080
    HTTPS_PORT=8443
    
    # AUTHENTICATION (Required for CRM Lobby/Moderation features)
    ENABLE_AUTH=1
    ENABLE_GUESTS=1
    AUTH_TYPE=jwt
    JWT_APP_ID=devrolin
    JWT_APP_SECRET=your_secret_here  # Must match CRM .env
    JWT_ACCEPTED_ISSUERS=devrolin
    JWT_ACCEPTED_AUDIENCES=jitsi
    ```
4.  **Start Jitsi**:
    ```bash
    docker-compose up -d
    ```
5.  **Access**:
    Open `https://localhost:8443` in your browser. You will see a certificate warning; accept it (Self-signed).

---

## 2. Production Setup (Ubuntu VPS)

### Prerequisites
- Ubuntu 22.04+ VPS.
- A Domain Name (e.g., `jitsi.yourdomain.com`) pointing to your VPS IP.

### Step-by-Step Installation
1.  **Install Docker & Docker Compose**:
    ```bash
    sudo apt update
    sudo apt install docker.io docker-compose -y
    ```
2.  **Clone and Prepare**:
    ```bash
    git clone https://github.com/jitsi/docker-jitsi-meet
    cd docker-jitsi-meet
    cp env.example .env
    ./gen-passwords.sh
    ```
3.  **Configure .env**:
    ```env
    PUBLIC_URL=https://jitsi.yourdomain.com
    
    # Authentication (Same as local)
    ENABLE_AUTH=1
    ENABLE_GUESTS=1
    AUTH_TYPE=jwt
    JWT_APP_ID=devrolin
    JWT_APP_SECRET=your_secure_secret
    
    # Let's Encrypt SSL
    ENABLE_LETSENCRYPT=1
    LETSENCRYPT_EMAIL=admin@yourdomain.com
    LETSENCRYPT_DOMAIN=jitsi.yourdomain.com
    ```
4.  **Configure Firewall (UFW)**:
    ```bash
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 10000/udp
    sudo ufw allow 4443/tcp
    sudo ufw allow 3478/udp
    sudo ufw allow 5349/tcp
    ```
5.  **Start**:
    ```bash
    docker-compose up -d
    ```

---

## 3. CRM Integration

In your CRM `.env` file, update the Jitsi section to match:

```env
# CRM .env
JITSI_DOMAIN=jitsi.yourdomain.com  # or localhost:8443
JITSI_SERVER_URL=https://jitsi.yourdomain.com # or https://localhost:8443
JITSI_APP_ID=devrolin
JITSI_APP_SECRET=your_secret_here
```

### Important Notes
- **Lobby Feature**: The Lobby feature I built relies on `AUTH_TYPE=jwt`. If authentication is disabled on the Jitsi server, the CRM token is ignored, and anyone can join without moderation.
- **Microphone/Camera**: Browsers block media access on `http`. Always use `https` (even if self-signed).
