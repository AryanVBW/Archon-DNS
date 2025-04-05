# Archon DNS Production Deployment Guide

This guide provides step-by-step instructions for deploying Archon DNS on an Ubuntu EC2 instance with auto-start capabilities.

## Prerequisites

- Ubuntu EC2 instance (Ubuntu 20.04 LTS or newer recommended)
- Root or sudo access
- Open ports:
  - 53 TCP/UDP (DNS service)
  - 3000 TCP (Web interface)
  - 22 TCP (SSH access)

## Automatic Installation

For a quick setup, use the provided installation script:

1. SSH into your EC2 instance:
   ```
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. Clone the repository:
   ```
   git clone https://github.com/AryanVBW/Archon-DNS.git
   cd Archon-DNS
   ```

3. Make the installation script executable:
   ```
   chmod +x deployment/install.sh
   ```

4. Run the installation script:
   ```
   sudo ./deployment/install.sh
   ```

5. Follow the prompts to configure your admin credentials.

## Manual Installation

If you prefer to install manually, follow these steps:

### 1. Update your system
```
sudo apt update
sudo apt upgrade -y
```

### 2. Install Node.js and MongoDB
```
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 3. Clone and set up the application
```
sudo mkdir -p /opt/archon-dns
sudo chown ubuntu:ubuntu /opt/archon-dns
git clone https://github.com/AryanVBW/Archon-DNS.git /opt/archon-dns
cd /opt/archon-dns
npm install --production
```

### 4. Configure environment variables
```
cp deployment/.env.production .env
```

Edit the `.env` file to set your custom settings:
```
nano .env
```

### 5. Set up the systemd service
```
sudo cp deployment/archon-dns.service /etc/systemd/system/
sudo sed -i 's|/home/ubuntu/Archon-DNS|/opt/archon-dns|g' /etc/systemd/system/archon-dns.service
sudo systemctl daemon-reload
sudo systemctl enable archon-dns
sudo systemctl start archon-dns
```

### 6. Configure firewall
```
sudo ufw allow 53/tcp
sudo ufw allow 53/udp
sudo ufw allow 3000/tcp
```

## EC2 Configuration Requirements

For Archon DNS to function properly on your EC2 instance, make the following adjustments:

1. **Security Group Configuration**:
   - Allow inbound traffic on port 53 (TCP/UDP) for DNS service
   - Allow inbound traffic on port 3000 (TCP) for the web interface
   - Allow inbound traffic on port 22 (TCP) for SSH access

2. **Elastic IP (Recommended)**:
   - Assign an Elastic IP to your instance for a static public IP address
   - This ensures your DNS server has a consistent address

3. **IAM Role (Optional)**:
   - If you plan to use AWS services like S3 for backups, attach an appropriate IAM role

## Testing Your Installation

1. **Check if the service is running**:
   ```
   sudo systemctl status archon-dns
   ```

2. **View logs**:
   ```
   sudo journalctl -u archon-dns
   ```

3. **Test DNS resolution**:
   ```
   dig @localhost example.com
   ```

4. **Access the web interface**:
   Open a browser and navigate to `http://your-ec2-ip:3000`

## Troubleshooting

### Service fails to start
- Check logs: `sudo journalctl -u archon-dns`
- Verify MongoDB is running: `sudo systemctl status mongodb`
- Check permissions: `ls -la /opt/archon-dns`

### DNS resolution not working
- Verify port 53 is open: `sudo lsof -i :53`
- Check if another service is using port 53: `sudo netstat -tulpn | grep 53`
- If systemd-resolved is using port 53, you may need to disable it:
  ```
  sudo systemctl disable systemd-resolved
  sudo systemctl stop systemd-resolved
  ```

### Web interface not accessible
- Check if the service is running: `sudo systemctl status archon-dns`
- Verify port 3000 is open in your security group
- Check the application logs for errors

## Maintenance

### Updating the application
```
cd /opt/archon-dns
git pull
npm install --production
sudo systemctl restart archon-dns
```

### Backing up your data
To backup your MongoDB database:
```
mongodump --db archon-dns --out /backup/path
```

### Monitoring
Consider setting up monitoring using tools like:
- AWS CloudWatch
- Prometheus and Grafana
- Simple monitoring with cron jobs and email alerts

## Security Recommendations

1. **Change default credentials**:
   - Update the admin password immediately after installation
   - Use a strong, unique password

2. **Secure MongoDB**:
   - Enable authentication for MongoDB
   - Restrict network access to the MongoDB port

3. **Use HTTPS for the web interface**:
   - Set up Nginx as a reverse proxy with Let's Encrypt SSL

4. **Regular updates**:
   - Keep your system and the application updated
   - Subscribe to security announcements for Ubuntu and Node.js

## Support and Maintenance

For issues or questions, please open an issue on the GitHub repository or contact the maintainer.
