#!/bin/bash
set -eu
release=/opt/solventir/releases/f30e0d751e745a55760a6228ba8838947e840e45a0af6ab0c2c48fc2414a17c1
install -d -m 0755 "$release"
tar -xzf /home/ec2-user/solventir-sjay-service.tar.gz -C "$release"
chown -R root:solventir "$release"
chmod -R g=rX,o= "$release"
install -m 0640 -o root -g solventir /home/ec2-user/service.env /etc/solventir/service.env
install -m 0644 -o root -g root /home/ec2-user/solventir-api.service /etc/systemd/system/solventir-api.service
ln -sfn "$release" /opt/solventir/current
systemctl daemon-reload
systemctl enable --now solventir-api
rm -f /home/ec2-user/service.env
systemctl is-active solventir-api
