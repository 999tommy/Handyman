const app = require('./src/app');
const fs = require('fs');
const http = require('http');

// create a dummy image locally
fs.writeFileSync('dummy.jpg', 'fake image content for testing jpeg');

const PORT = 3006;
const server = app.listen(PORT, () => {
    
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    let data = '';
    data += '--' + boundary + '\r\n';
    data += 'Content-Disposition: form-data; name="file"; filename="dummy.jpg"\r\n';
    data += 'Content-Type: image/jpeg\r\n\r\n';
    data += fs.readFileSync('dummy.jpg').toString() + '\r\n';
    data += '--' + boundary + '--\r\n';

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/upload/profile-picture',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
        server.close();
        fs.unlinkSync('dummy.jpg');
        process.exit(0);
      });
    });
    
    req.write(data);
    req.end();
});
