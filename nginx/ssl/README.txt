# SSL 证书目录

请将您的 SSL 证书和私钥文件放入此目录：

- `cert.pem` - 证书文件 (fullchain.pem)
- `key.pem` - 私钥文件

可以从 Let's Encrypt 获取免费证书，或使用其他证书颁发机构。

获取证书后，运行以下命令设置正确的权限：
```bash
chmod 600 key.pem
```
