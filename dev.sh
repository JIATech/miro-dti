#!/bin/bash

# Script para gestionar el entorno de desarrollo del sistema Intercom
# Utiliza las variables de entorno de .env.develop

# Colores para mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ruta del proyecto
PROJECT_DIR="$(pwd)"
ENV_FILE="$PROJECT_DIR/.env.develop"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.develop.yml"

# Verificar que existe el archivo .env.develop
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: No se encontró el archivo .env.develop${NC}"
    echo "Crea este archivo con las variables de entorno necesarias."
    exit 1
fi

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker no está instalado${NC}"
    echo "Para instalar Docker, visita: https://docs.docker.com/get-docker/"
    exit 1
fi

# Cargar variables de entorno
set -a
source "$ENV_FILE"
set +a

# Mostrar información
show_info() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Sistema Intercom - Modo Desarrollo   ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo
    echo -e "${YELLOW}IP Local:${NC} $LOCAL_IP"
    echo
    echo -e "${YELLOW}Servicios disponibles:${NC}"
    echo -e "- PWA: ${GREEN}http://$LOCAL_IP:$PWA_PORT${NC}"
    echo -e "- Servidor de Señalización: ${GREEN}http://$LOCAL_IP:$SIGNALING_PORT${NC}"
    echo -e "- MiroTalkSFU: ${GREEN}http://$LOCAL_IP:$SFU_PORT${NC}"
    echo -e "- Panel Admin: ${GREEN}http://$LOCAL_IP:$ADMIN_PORT${NC} (credenciales: $ADMIN_USER / $ADMIN_PASSWORD)"
    echo
    echo -e "${YELLOW}Comandos disponibles:${NC}"
    echo -e "  ${GREEN}./dev.sh start${NC}    - Iniciar todos los servicios"
    echo -e "  ${GREEN}./dev.sh stop${NC}     - Detener todos los servicios"
    echo -e "  ${GREEN}./dev.sh restart${NC}  - Reiniciar todos los servicios"
    echo -e "  ${GREEN}./dev.sh status${NC}   - Mostrar estado de los servicios"
    echo -e "  ${GREEN}./dev.sh logs${NC}     - Ver logs de todos los servicios"
    echo -e "  ${GREEN}./dev.sh logs <servicio>${NC} - Ver logs de un servicio específico"
    echo -e "  ${GREEN}./dev.sh install${NC}  - Instalar dependencias para desarrollo local"
    echo
}

# Función para ejecutar docker compose
docker_compose() {
    # Intentar primero con docker compose (nuevo formato)
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" "$@"
    # Intentar con docker-compose (formato antiguo) si está disponible
    elif command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" "$@"
    else
        echo -e "${RED}Error: No se encontró ni 'docker compose' ni 'docker-compose'${NC}"
        echo "Para continuar, instala Docker Compose:"
        echo -e "  ${YELLOW}sudo apt-get update && sudo apt-get install -y docker-compose-plugin${NC}"
        echo -e "o visita: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

# Iniciar servicios
start_services() {
    echo -e "${YELLOW}Iniciando servicios en modo desarrollo...${NC}"
    docker_compose up -d --build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Servicios iniciados correctamente.${NC}"
        echo "Espera unos segundos para que todos los servicios estén listos..."
        sleep 5
        
        check_status
    else
        echo -e "${RED}Error al iniciar los servicios.${NC}"
    fi
}

# Detener servicios
stop_services() {
    echo -e "${YELLOW}Deteniendo servicios...${NC}"
    docker_compose down
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Servicios detenidos.${NC}"
    else
        echo -e "${RED}Error al detener los servicios.${NC}"
    fi
}

# Reiniciar servicios
restart_services() {
    echo -e "${YELLOW}Reiniciando servicios...${NC}"
    docker_compose restart
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Servicios reiniciados.${NC}"
    else
        echo -e "${RED}Error al reiniciar los servicios.${NC}"
    fi
}

# Verificar estado
check_status() {
    echo -e "${YELLOW}Estado de los servicios:${NC}"
    docker_compose ps
}

# Ver logs
show_logs() {
    if [ -z "$1" ]; then
        echo -e "${YELLOW}Mostrando logs de todos los servicios (Ctrl+C para salir):${NC}"
        docker_compose logs -f
    else
        echo -e "${YELLOW}Mostrando logs de $1 (Ctrl+C para salir):${NC}"
        docker_compose logs -f "$1"
    fi
}

# Instalar dependencias para desarrollo
install_dependencies() {
    echo -e "${YELLOW}Instalando dependencias para desarrollo...${NC}"
    
    # Verificar si ya está instalado docker compose plugin
    if docker compose version &> /dev/null; then
        echo -e "${GREEN}El plugin docker compose ya está instalado.${NC}"
    else
        # Intentar instalar docker-compose-plugin
        echo -e "${YELLOW}Instalando docker compose plugin...${NC}"
        sudo apt-get update && sudo apt-get install -y docker-compose-plugin
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}No se pudo instalar automáticamente.${NC}"
            echo "Visita https://docs.docker.com/compose/install/ para instrucciones de instalación."
        else
            echo -e "${GREEN}Docker compose plugin instalado correctamente.${NC}"
        fi
    fi
}

# Comando principal
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs "$2"
        ;;
    install)
        install_dependencies
        ;;
    *)
        show_info
        ;;
esac

exit 0
