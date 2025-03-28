#!/bin/bash

# Script para ejecutar los servicios del sistema Intercom en modo local
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

# Verificar que existe el archivo .env.develop
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: No se encontró el archivo .env.develop${NC}"
    echo "Crea este archivo con las variables de entorno necesarias."
    exit 1
fi

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js no está instalado${NC}"
    echo "Para instalar Node.js, visita: https://nodejs.org/"
    exit 1
fi

# Cargar variables de entorno
set -a
source "$ENV_FILE"
set +a

# Variables para procesos
PWA_PID=""
SIGNALING_PID=""
ADMIN_PID=""

# Mostrar información
show_info() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Sistema Intercom - Modo Local   ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo
    echo -e "${YELLOW}IP Local:${NC} $LOCAL_IP"
    echo
    echo -e "${YELLOW}Servicios que serán iniciados:${NC}"
    echo -e "- PWA: ${GREEN}http://$LOCAL_IP:$PWA_PORT${NC}"
    echo -e "- Servidor de Señalización: ${GREEN}http://$LOCAL_IP:$SIGNALING_PORT${NC}"
    echo -e "- Panel Admin: ${GREEN}http://$LOCAL_IP:$ADMIN_PORT${NC} (credenciales: $ADMIN_USER / $ADMIN_PASSWORD)"
    echo -e "${RED}Nota: MiroTalkSFU no está disponible en modo local sin Docker${NC}"
    echo
    echo -e "${YELLOW}Comandos disponibles:${NC}"
    echo -e "  ${GREEN}./dev-local.sh start${NC}    - Iniciar servicios locales"
    echo -e "  ${GREEN}./dev-local.sh stop${NC}     - Detener servicios locales"
    echo -e "  ${GREEN}./dev-local.sh status${NC}   - Mostrar estado de los servicios"
    echo -e "  ${GREEN}./dev-local.sh install${NC}  - Instalar dependencias para desarrollo local"
    echo -e "  ${GREEN}./dev-local.sh clean${NC}    - Limpiar procesos y liberar puertos"
    echo
}

# Limpiar procesos y liberar puertos
clean_processes() {
    echo -e "${YELLOW}Limpiando procesos...${NC}"
    
    # Primero intentamos detener normalmente
    stop_services
    
    # Verificar puertos en uso para PWA
    local pwa_pids=$(lsof -t -i:$PWA_PORT 2>/dev/null)
    if [ -n "$pwa_pids" ]; then
        echo -e "Liberando puerto $PWA_PORT para PWA..."
        kill -9 $pwa_pids 2>/dev/null
    fi
    
    # Verificar puertos en uso para Signaling
    local signaling_pids=$(lsof -t -i:$SIGNALING_PORT 2>/dev/null)
    if [ -n "$signaling_pids" ]; then
        echo -e "Liberando puerto $SIGNALING_PORT para Servidor de Señalización..."
        kill -9 $signaling_pids 2>/dev/null
    fi
    
    # Verificar puertos en uso para Admin
    local admin_pids=$(lsof -t -i:$ADMIN_PORT 2>/dev/null)
    if [ -n "$admin_pids" ]; then
        echo -e "Liberando puerto $ADMIN_PORT para Panel de Administración..."
        kill -9 $admin_pids 2>/dev/null
    fi
    
    # También buscar procesos http-server y node server.js
    local http_pids=$(ps aux | grep http-server | grep -v grep | awk '{print $2}')
    if [ -n "$http_pids" ]; then
        echo -e "Terminando procesos http-server..."
        kill -9 $http_pids 2>/dev/null
    fi
    
    local node_pids=$(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}')
    if [ -n "$node_pids" ]; then
        echo -e "Terminando procesos node server.js..."
        kill -9 $node_pids 2>/dev/null
    fi
    
    echo -e "${GREEN}Limpieza completada.${NC}"
    
    # Verificar si los puertos están libres ahora
    echo -e "${YELLOW}Verificando puertos...${NC}"
    sleep 1
    
    local ports_in_use=""
    lsof -i:$PWA_PORT &>/dev/null && ports_in_use="$ports_in_use $PWA_PORT"
    lsof -i:$SIGNALING_PORT &>/dev/null && ports_in_use="$ports_in_use $SIGNALING_PORT"
    lsof -i:$ADMIN_PORT &>/dev/null && ports_in_use="$ports_in_use $ADMIN_PORT"
    
    if [ -n "$ports_in_use" ]; then
        echo -e "${RED}Algunos puertos siguen ocupados:${NC}$ports_in_use"
        echo -e "${YELLOW}¿Deseas buscar puertos alternativos? (s/n)${NC}"
        read -r response
        if [[ "$response" =~ ^[Ss]$ ]]; then
            find_alternative_ports
        fi
    else
        echo -e "${GREEN}Todos los puertos están libres y listos para usar.${NC}"
    fi
}

# Buscar puertos alternativos
find_alternative_ports() {
    echo -e "${YELLOW}Buscando puertos alternativos...${NC}"
    
    # Buscar puerto libre para PWA
    local new_pwa_port=$(find_free_port 8000)
    
    # Buscar puerto libre para Signaling
    local new_signaling_port=$(find_free_port 3000)
    
    # Buscar puerto libre para Admin
    local new_admin_port=$(find_free_port 8090)
    
    echo -e "${GREEN}Puertos alternativos encontrados:${NC}"
    echo -e "- PWA: $new_pwa_port (original: $PWA_PORT)"
    echo -e "- Servidor de Señalización: $new_signaling_port (original: $SIGNALING_PORT)"
    echo -e "- Panel Admin: $new_admin_port (original: $ADMIN_PORT)"
    
    echo -e "${YELLOW}¿Deseas actualizar el archivo .env.develop con estos puertos? (s/n)${NC}"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        update_env_file $new_pwa_port $new_signaling_port $new_admin_port
    fi
}

# Encontrar un puerto libre
find_free_port() {
    local base_port=$1
    local port=$base_port
    
    while lsof -i:$port &>/dev/null; do
        ((port++))
        if [ $port -gt $(($base_port + 100)) ]; then
            # Si hemos probado 100 puertos sin éxito, regresamos uno aleatorio alto
            port=$((10000 + RANDOM % 10000))
            break
        fi
    done
    
    echo $port
}

# Actualizar archivo .env.develop
update_env_file() {
    local new_pwa_port=$1
    local new_signaling_port=$2
    local new_admin_port=$3
    
    # Hacer backup del archivo original
    cp "$ENV_FILE" "${ENV_FILE}.bak"
    
    # Actualizar el archivo
    sed -i "s/PWA_PORT=.*/PWA_PORT=$new_pwa_port/" "$ENV_FILE"
    sed -i "s/SIGNALING_PORT=.*/SIGNALING_PORT=$new_signaling_port/" "$ENV_FILE"
    sed -i "s/ADMIN_PORT=.*/ADMIN_PORT=$new_admin_port/" "$ENV_FILE"
    
    echo -e "${GREEN}Archivo .env.develop actualizado. Se ha creado un backup en ${ENV_FILE}.bak${NC}"
    
    # Recargar variables de entorno
    set -a
    source "$ENV_FILE"
    set +a
}

# Instalar dependencias
install_dependencies() {
    echo -e "${YELLOW}Instalando dependencias para desarrollo local...${NC}"
    
    # Crear directorio para pwa si no existe
    if [ ! -d "$PROJECT_DIR/pwa/node_modules" ]; then
        mkdir -p "$PROJECT_DIR/pwa/node_modules"
    fi
    
    # Instalar http-server localmente para PWA
    echo -e "${YELLOW}Instalando http-server localmente para PWA...${NC}"
    cd "$PROJECT_DIR/pwa" && npm install http-server --save-dev
    
    # Instalar dependencias para signaling
    echo -e "${YELLOW}Instalando dependencias para el servidor de señalización...${NC}"
    cd "$PROJECT_DIR/signaling" && npm install
    
    # Instalar dependencias para admin
    echo -e "${YELLOW}Instalando dependencias para el panel de administración...${NC}"
    cd "$PROJECT_DIR/admin" && npm install
    
    echo -e "${GREEN}Instalación completada.${NC}"
}

# Iniciar servicios
start_services() {
    # Primero verificar si hay procesos que estén usando los puertos
    local ports_in_use=""
    lsof -i:$PWA_PORT &>/dev/null && ports_in_use="$ports_in_use $PWA_PORT"
    lsof -i:$SIGNALING_PORT &>/dev/null && ports_in_use="$ports_in_use $SIGNALING_PORT"
    lsof -i:$ADMIN_PORT &>/dev/null && ports_in_use="$ports_in_use $ADMIN_PORT"
    
    if [ -n "$ports_in_use" ]; then
        echo -e "${RED}Algunos puertos están ocupados:${NC}$ports_in_use"
        echo -e "${YELLOW}Por favor, ejecuta primero './dev-local.sh clean' para liberar los puertos.${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Iniciando servicios en modo local...${NC}"
    
    # Iniciar PWA con http-server
    echo -e "${YELLOW}Iniciando PWA...${NC}"
    cd "$PROJECT_DIR/pwa" && npx http-server -p $PWA_PORT --cors &
    PWA_PID=$!
    
    # Iniciar servidor de señalización
    echo -e "${YELLOW}Iniciando servidor de señalización...${NC}"
    cd "$PROJECT_DIR/signaling" && NODE_ENV=development SIGNALING_PORT=$SIGNALING_PORT LOCAL_IP=$LOCAL_IP CORS_ORIGIN="*" node server.js &
    SIGNALING_PID=$!
    
    # Iniciar panel admin
    echo -e "${YELLOW}Iniciando panel de administración...${NC}"
    cd "$PROJECT_DIR/admin" && NODE_ENV=development ADMIN_PORT=$ADMIN_PORT ADMIN_USER=$ADMIN_USER ADMIN_PASSWORD=$ADMIN_PASSWORD LOCAL_IP=$LOCAL_IP node server.js &
    ADMIN_PID=$!
    
    # Esperar un momento
    sleep 2
    
    # Guardar PIDs
    echo "$PWA_PID $SIGNALING_PID $ADMIN_PID" > "$PROJECT_DIR/.dev-pids"
    
    echo -e "${GREEN}Servicios iniciados.${NC}"
    echo -e "${YELLOW}Accede a:${NC}"
    echo -e "- PWA: ${GREEN}http://$LOCAL_IP:$PWA_PORT${NC}"
    echo -e "- Servidor de Señalización: ${GREEN}http://$LOCAL_IP:$SIGNALING_PORT${NC}"
    echo -e "- Panel Admin: ${GREEN}http://$LOCAL_IP:$ADMIN_PORT${NC}"
    echo
    echo -e "${YELLOW}Para detener los servicios:${NC} ./dev-local.sh stop"
}

# Detener servicios
stop_services() {
    echo -e "${YELLOW}Deteniendo servicios...${NC}"
    
    if [ -f "$PROJECT_DIR/.dev-pids" ]; then
        read -r PWA_PID SIGNALING_PID ADMIN_PID < "$PROJECT_DIR/.dev-pids"
        
        if [ -n "$PWA_PID" ]; then
            kill $PWA_PID 2>/dev/null || true
            echo -e "PWA detenido."
        fi
        
        if [ -n "$SIGNALING_PID" ]; then
            kill $SIGNALING_PID 2>/dev/null || true
            echo -e "Servidor de señalización detenido."
        fi
        
        if [ -n "$ADMIN_PID" ]; then
            kill $ADMIN_PID 2>/dev/null || true
            echo -e "Panel de administración detenido."
        fi
        
        rm "$PROJECT_DIR/.dev-pids"
        echo -e "${GREEN}Todos los servicios detenidos.${NC}"
    else
        echo -e "${YELLOW}No hay servicios en ejecución controlados por este script.${NC}"
    fi
}

# Verificar estado
check_status() {
    echo -e "${YELLOW}Estado de los servicios:${NC}"
    
    # Verificar puertos
    echo -e "\n${YELLOW}Puertos configurados:${NC}"
    echo -e "- PWA: $PWA_PORT - $(lsof -i:$PWA_PORT &>/dev/null && echo "${GREEN}En uso${NC}" || echo "${RED}Libre${NC}")"
    echo -e "- Servidor de Señalización: $SIGNALING_PORT - $(lsof -i:$SIGNALING_PORT &>/dev/null && echo "${GREEN}En uso${NC}" || echo "${RED}Libre${NC}")"
    echo -e "- Panel Admin: $ADMIN_PORT - $(lsof -i:$ADMIN_PORT &>/dev/null && echo "${GREEN}En uso${NC}" || echo "${RED}Libre${NC}")"
    
    echo -e "\n${YELLOW}Procesos:${NC}"
    if [ -f "$PROJECT_DIR/.dev-pids" ]; then
        read -r PWA_PID SIGNALING_PID ADMIN_PID < "$PROJECT_DIR/.dev-pids"
        
        # Verificar PWA
        if [ -n "$PWA_PID" ] && ps -p $PWA_PID > /dev/null; then
            echo -e "PWA: ${GREEN}Activo${NC} (PID: $PWA_PID)"
        else
            echo -e "PWA: ${RED}Inactivo${NC}"
        fi
        
        # Verificar servidor de señalización
        if [ -n "$SIGNALING_PID" ] && ps -p $SIGNALING_PID > /dev/null; then
            echo -e "Servidor de señalización: ${GREEN}Activo${NC} (PID: $SIGNALING_PID)"
        else
            echo -e "Servidor de señalización: ${RED}Inactivo${NC}"
        fi
        
        # Verificar panel admin
        if [ -n "$ADMIN_PID" ] && ps -p $ADMIN_PID > /dev/null; then
            echo -e "Panel de administración: ${GREEN}Activo${NC} (PID: $ADMIN_PID)"
        else
            echo -e "Panel de administración: ${RED}Inactivo${NC}"
        fi
    else
        echo -e "${YELLOW}No hay información de procesos disponible.${NC}"
        
        # Buscar procesos relacionados
        echo -e "\n${YELLOW}Procesos relacionados encontrados:${NC}"
        ps aux | grep -E "http-server|server.js" | grep -v grep || echo "Ninguno encontrado"
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
    status)
        check_status
        ;;
    install)
        install_dependencies
        ;;
    clean)
        clean_processes
        ;;
    *)
        show_info
        ;;
esac

exit 0
