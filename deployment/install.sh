#!/bin/bash

# Exit script if any command fails
set -e

echo "=== Archon DNS Server Installation Script ==="
echo "This script will install and configure Archon DNS on your Ubuntu server."

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

# Update system packages
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install dependencies
echo "Installing dependencies..."
apt-get install -y curl gnupg build-essential git

# Install Node.js 16.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install -y nodejs

# Install MongoDB
echo "Installing MongoDB..."
apt-get install -y mongodb

# Start and enable MongoDB service
echo "Starting MongoDB service..."
systemctl start mongodb
systemctl enable mongodb

# Create directory for the application
echo "Creating application directory..."
APP_DIR="/opt/archon-dns"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone the repository
echo "Cloning Archon DNS repository..."
git clone https://github.com/AryanVBW/Archon-DNS.git .

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production

# Create log directory
echo "Creating log directory..."
mkdir -p /var/log/archon-dns
chown -R ubuntu:ubuntu /var/log/archon-dns

# Copy production environment file
echo "Setting up environment configuration..."
cp deployment/.env.production .env

# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
sed -i "s/change_this_to_a_secure_random_string_in_production/$JWT_SECRET/" .env

# Prompt for admin credentials
echo "Setting up admin credentials..."
read -p "Enter admin email: " ADMIN_EMAIL
read -s -p "Enter admin password: " ADMIN_PASSWORD
echo ""

# Update .env file with admin credentials
sed -i "s/admin@yourdomain.com/$ADMIN_EMAIL/" .env
sed -i "s/change_this_to_a_secure_password/$ADMIN_PASSWORD/" .env

# Set proper ownership
echo "Setting file permissions..."
chown -R ubuntu:ubuntu $APP_DIR

# Install systemd service
echo "Installing systemd service..."
cp deployment/archon-dns.service /etc/systemd/system/
sed -i "s|/home/ubuntu/Archon-DNS|$APP_DIR|g" /etc/systemd/system/archon-dns.service

# Reload systemd, enable and start the service
echo "Starting Archon DNS service..."
systemctl daemon-reload
systemctl enable archon-dns
systemctl start archon-dns

# Configure firewall if UFW is enabled
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    echo "Configuring firewall rules..."
    ufw allow 53/tcp
    ufw allow 53/udp
    ufw allow 3000/tcp
fi

echo "=== Installation Complete ==="
echo "Archon DNS is now running as a service and will start automatically on boot."
echo "Web interface: http://your-server-ip:3000"
echo "DNS server is running on port 53 (standard DNS port)"
echo ""
echo "To check the status of the service, run: systemctl status archon-dns"
echo "To view logs, run: journalctl -u archon-dns"
