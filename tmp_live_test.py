import json, urllib.request, urllib.error

BASE = 'https://handyman-1-drwc.onrender.com/api'

def request(method, path, data=None, token=None, forwarded_for='203.0.113.10'):
    headers = {'X-Forwarded-For': forwarded_for, 'X-Real-IP': forwarded_for}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = None if data is None else json.dumps(data).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode('utf-8')
            return resp.status, json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        text = e.read().decode('utf-8')
        try:
            payload = json.loads(text)
        except Exception:
            payload = text
        raise RuntimeError(f'HTTP {e.code}: {payload}')

print('Customer login attempt with alternate IP...')
status, login = request('POST', '/auth/login', {'email': 'clienttestuser@gmail.com', 'password': 'ClientTest2026!'}, forwarded_for='198.51.100.20')
print('status', status)
print(json.dumps(login, indent=2))
