#!/bin/bash

# Exit script if any command fails
set -e

echo "=== MongoDB Setup Script for Archon DNS ==="
echo "This script will install and configure MongoDB for your Archon DNS server."

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

# Install MongoDB
echo "Installing MongoDB..."
apt-get update
apt-get install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
   gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg \
   --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | \
   tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update
apt-get install -y mongodb-org

# Create data directory if it doesn't exist
echo "Setting up data directory..."
mkdir -p /var/lib/mongodb
chown -R mongodb:mongodb /var/lib/mongodb

# Create log directory if it doesn't exist
echo "Setting up log directory..."
mkdir -p /var/log/mongodb
chown -R mongodb:mongodb /var/log/mongodb

# Create systemd service file
echo "Creating systemd service file..."
cat > /etc/systemd/system/mongodb.service << EOF
[Unit]
Description=MongoDB Database Service
After=network.target
Documentation=https://docs.mongodb.org/manual

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod.conf
PIDFile=/var/run/mongodb/mongod.pid
Type=forking
# file size
LimitFSIZE=infinity
# cpu time
LimitCPU=infinity
# virtual memory size
LimitAS=infinity
# open files
LimitNOFILE=64000
# processes/threads
LimitNPROC=64000
# locked memory
LimitMEMLOCK=infinity
# total threads (user+kernel)
TasksMax=infinity
TasksAccounting=false
# Recommended limits for mongod as specified in
# https://docs.mongodb.com/manual/reference/ulimit/#recommended-ulimit-settings

[Install]
WantedBy=multi-user.target
EOF

# Create MongoDB configuration file
echo "Creating MongoDB configuration file..."
cat > /etc/mongod.conf << EOF
# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

# Where and how to store data.
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1

# how the process runs
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid

# security settings
security:
  authorization: disabled
EOF

# Create directory for PID file
mkdir -p /var/run/mongodb
chown mongodb:mongodb /var/run/mongodb

# Reload systemd, enable and start the service
echo "Starting MongoDB service..."
systemctl daemon-reload
systemctl enable mongodb
systemctl start mongodb

# Wait for MongoDB to start
echo "Waiting for MongoDB to start..."
sleep 5

# Create Archon DNS database and user
echo "Creating Archon DNS database and user..."
mongosh --eval "
  db = db.getSiblingDB('archon_dns');
  db.createUser({
    user: 'archon',
    pwd: 'archon_password',  // Change this to a secure password
    roles: [{ role: 'readWrite', db: 'archon_dns' }]
  });
  db.createCollection('users');
  print('Database and user created successfully');
"

# Update .env file with MongoDB credentials
echo "Updating .env file with MongoDB credentials..."
if [ -f "/opt/archon-dns/.env" ]; then
    sed -i "s|mongodb://localhost:27017/archon-dns|mongodb://archon:archon_password@localhost:27017/archon_dns|g" /opt/archon-dns/.env
    echo "Updated MongoDB connection string in .env file"
else
    echo "Warning: .env file not found at /opt/archon-dns/.env"
    echo "Please manually update your MongoDB connection string to:"
    echo "mongodb://archon:archon_password@localhost:27017/archon_dns"
fi

# Enable authentication in MongoDB
echo "Enabling MongoDB authentication..."
sed -i "s/authorization: disabled/authorization: enabled/g" /etc/mongod.conf

# Restart MongoDB with authentication enabled
echo "Restarting MongoDB with authentication enabled..."
systemctl restart mongodb

echo "=== MongoDB Setup Complete ==="
echo "MongoDB is now running as a service and will start automatically on boot."
echo "Database: archon_dns"
echo "Username: archon"
echo "Password: archon_password (change this in production)"
echo ""
echo "To check the status of the service, run: systemctl status mongodb"
echo "To view logs, run: less /var/log/mongodb/mongod.log"
