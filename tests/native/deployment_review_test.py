import hashlib, json, os, pathlib, subprocess, uuid, zipfile

# Run after sftp_loopback_test.py, with WEBSTUDIO_SFTP_FIXTURE set to its folder.
fixture = pathlib.Path(os.environ['WEBSTUDIO_SFTP_FIXTURE'])
root = pathlib.Path(__file__).resolve().parents[2]
exe = root / 'test-results' / 'm6-sftp-build' / 'SftpConnectionSmoke.exe'
work = root / 'test-results' / ('m6-native-review-' + uuid.uuid4().hex)
work.mkdir()
backup = fixture / 'destination backup.zip'
scan = fixture / 'live destination scan.json'
desired = work / 'website.zip'
with zipfile.ZipFile(desired, 'w', compression=zipfile.ZIP_STORED) as archive:
    archive.writestr('index.html', b'updated page')
    archive.writestr('new.txt', b'new content')
    archive.writestr('empty.txt', b'')

def review(site, scan_file, backup_file):
    return subprocess.run([str(exe), str(site), str(scan_file), str(backup_file)] + ['test'] * 9, capture_output=True, text=True, timeout=30)

result = review(desired, scan, backup)
expected = {'A:new.txt', 'C:index.html', 'R:assets/image.png',
            'W:' + hashlib.sha256(desired.read_bytes()).hexdigest(),
            'S:' + hashlib.sha256(scan.read_bytes()).hexdigest(),
            'B:' + hashlib.sha256(backup.read_bytes()).hexdigest()}
if result.returncode or set(result.stdout.splitlines()) != expected:
    raise SystemExit('Native review failed: ' + result.stdout + result.stderr)

bad_scan = work / 'bad-scan.json'
data = json.loads(scan.read_text(encoding='utf8'))
data['files'][0]['sha256'] = '0' * 64
bad_scan.write_text(json.dumps(data), encoding='utf8')
assert review(desired, bad_scan, backup).returncode != 0

bad_zip = work / 'corrupt.zip'
corrupted = bytearray(desired.read_bytes())
offset = corrupted.index(b'updated page')
corrupted[offset] ^= 1
bad_zip.write_bytes(corrupted)
assert review(bad_zip, scan, backup).returncode != 0

unsafe = work / 'unsafe.zip'
with zipfile.ZipFile(unsafe, 'w') as archive:
    archive.writestr('../outside.txt', b'unsafe')
assert review(unsafe, scan, backup).returncode != 0

collision = work / 'collision.zip'
with zipfile.ZipFile(collision, 'w') as archive:
    archive.writestr('Page.html', b'one')
    archive.writestr('page.html', b'two')
assert review(collision, scan, backup).returncode != 0

conflict = work / 'conflict.zip'
with zipfile.ZipFile(conflict, 'w') as archive:
    archive.writestr('folder/file.txt', b'one')
    archive.writestr('folder', b'two')
assert review(conflict, scan, backup).returncode != 0
print('Native review matched the local SFTP fixture and rejected stale, corrupt, unsafe and conflicting inputs.')
