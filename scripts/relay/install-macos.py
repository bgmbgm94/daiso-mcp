#!/usr/bin/python3
"""검토한 중계 릴리스를 전용 표준 계정에 설치합니다. 기본은 변경 없는 계획 출력입니다."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import pwd
import shutil
import subprocess
import tempfile

RUNTIME = Path('/Library/Application Support/DaisoRelay')
USER = 'daisorelay'
LABEL = 'page.aka.daiso-oliveyoung'

def agent_plist(runtime, home, node):
    state = home / 'Library/Application Support/DaisoRelay'
    return {
        'Label': LABEL,
        'ProgramArguments': [str(node), '--max-old-space-size=256', '--env-file=' + str(state / 'relay.env'), '--import', 'tsx', str(runtime / 'scripts/relay/start.ts')],
        'WorkingDirectory': str(runtime),
        'EnvironmentVariables': {'HOME': str(home), 'PATH': '/opt/homebrew/bin:/usr/bin:/bin'},
        'RunAtLoad': True,
        'KeepAlive': {'SuccessfulExit': False},
        'ThrottleInterval': 60,
        'ExitTimeOut': 30,
        'ProcessType': 'Background',
        'LimitLoadToSessionType': 'Aqua',
        'AbandonProcessGroup': False,
        # stdout은 고정된 준비 문장뿐이며 운영 상태는 인증된 /health로 조회합니다.
        'StandardOutPath': '/dev/null',
        'StandardErrorPath': '/dev/null',
    }

def tunnel_plist(home, cloudflared):
    return {
        'Label': LABEL + '-tunnel',
        'ProgramArguments': [str(cloudflared), 'tunnel', '--no-autoupdate', 'run', '--token-file', str(home / 'Library/Application Support/DaisoRelay/tunnel-token')],
        'EnvironmentVariables': {'HOME': str(home), 'PATH': '/opt/homebrew/bin:/usr/bin:/bin'},
        'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 60,
        'ExitTimeOut': 30, 'AbandonProcessGroup': False, 'LimitLoadToSessionType': 'Aqua',
        'StandardOutPath': '/dev/null', 'StandardErrorPath': '/dev/null',
    }

def validate_tree(root):
    if root.is_symlink():
        raise ValueError('Symbolic link source root')
    for current, directories, files in os.walk(root):
        for name in directories + files:
            path = Path(current) / name
            if path.is_symlink():
                target = Path(os.readlink(path))
                try:
                    resolved = path.resolve(strict=True)
                except (OSError, RuntimeError) as error:
                    raise ValueError('Dangling source link') from error
                if target.is_absolute() or not resolved.is_relative_to(root):
                    raise ValueError('Escaping source link')


def write_owned(path, content, uid, gid, mode):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    try:
        os.fchown(descriptor, uid, gid)
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, 'wb', closefd=False) as stream:
            stream.write(content)
            stream.flush()
            os.fsync(descriptor)
    except BaseException:
        path.unlink()
        raise
    finally:
        os.close(descriptor)


def install_files(source, browser, runtime, home, user, credentials, node, cloudflared):
    for name in ['scripts/relay', 'src', 'node_modules']:
        validate_tree(source / name)
    validate_tree(browser)
    for name in ['package.json', 'package-lock.json', 'tsconfig.json']:
        if (source / name).is_symlink():
            raise ValueError('Symbolic link package input')
    state = home / 'Library/Application Support/DaisoRelay'
    agents = home / 'Library/LaunchAgents'
    for target in [state, agents]:
        for part in [target, *target.parents]:
            if part.is_symlink():
                raise ValueError('Symbolic link destination')
    for target in [state / 'relay.env', state / 'tunnel-token', agents / (LABEL + '.plist'), agents / (LABEL + '-tunnel.plist')]:
        if target.exists() or target.is_symlink():
            raise ValueError('Existing installation files require explicit upgrade review')
    for directory in [state, agents]:
        directory.mkdir(parents=True, exist_ok=True)
        os.chown(directory, user.pw_uid, user.pw_gid)
    os.chmod(state, 0o700)
    staging = Path(tempfile.mkdtemp(prefix='DaisoRelay.staging-', dir=runtime.parent))
    created = []
    promoted = False
    try:
        for name in ['scripts/relay', 'src', 'node_modules']:
            shutil.copytree(source / name, staging / name, symlinks=True)
        for name in ['package.json', 'package-lock.json', 'tsconfig.json']:
            shutil.copy2(source / name, staging / name, follow_symlinks=False)
        shutil.copytree(browser, staging / 'Browser.app', symlinks=True)
        validate_tree(staging)
        for root, dirs, files in os.walk(staging):
            for name in dirs + files:
                path = Path(root) / name
                if not path.is_symlink():
                    os.chown(path, os.geteuid(), os.getegid())
                    os.chmod(path, path.stat().st_mode & ~0o022)
        os.chmod(staging, 0o755)
        staging.rename(runtime)
        promoted = True
        env = {
            'OY_RELAY_TOKEN': credentials['relayToken'],
            'OY_RELAY_STATE_DIR': str(state / 'state'),
            'OY_BROWSER_EXECUTABLE': str(runtime / 'Browser.app/Contents/MacOS/Google Chrome for Testing'),
            'OY_RELAY_PORT': '4319',
        }
        for path, content in [(state / 'relay.env', ''.join(k + '=' + json.dumps(v) + '\n' for k, v in env.items())), (state / 'tunnel-token', credentials['tunnelToken'])]:
            write_owned(path, content.encode(), user.pw_uid, user.pw_gid, 0o600)
            created.append(path)
        for name, data in [(LABEL, agent_plist(runtime, home, node)), (LABEL + '-tunnel', tunnel_plist(home, cloudflared))]:
            path = agents / (name + '.plist')
            write_owned(path, plistlib.dumps(data), os.geteuid(), os.getegid(), 0o644)
            created.append(path)
    except BaseException:
        for path in reversed(created):
            path.unlink()
        shutil.rmtree(runtime if promoted else staging)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--browser-app', type=Path, required=True)
    parser.add_argument('--credentials', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    source = args.source.resolve()
    browser = args.browser_app.resolve()
    node = Path('/opt/homebrew/bin/node')
    cloudflared = Path('/opt/homebrew/bin/cloudflared')
    for path in [source / 'scripts/relay/start.ts', source / 'node_modules/tsx/package.json', browser / 'Contents/MacOS/Google Chrome for Testing', node, cloudflared]:
        if not path.exists():
            raise SystemExit('Missing installation input: ' + str(path))
    print('Target account: ' + USER + ' (must be a standard macOS account)')
    print('Root-owned runtime: ' + str(RUNTIME))
    print('Install two GUI-session LaunchAgents; no automatic login or immediate external activation.')
    if not args.apply:
        print('Plan only. Use --apply from an administrator terminal after review.')
        return
    if os.geteuid() != 0:
        raise SystemExit('Run the reviewed installer with sudo in your terminal. Never send passwords in chat.')
    try:
        user = pwd.getpwnam(USER)
    except KeyError:
        raise SystemExit('Create the standard account daisorelay in System Settings > Users & Groups first.')
    groups = subprocess.check_output(['/usr/bin/id', '-Gn', USER], text=True).split()
    if 'admin' in groups or user.pw_uid < 501:
        raise SystemExit('Refusing an administrator or system account.')
    home = Path(user.pw_dir)
    if home != Path('/Users/daisorelay') or home.is_symlink():
        raise SystemExit('Unexpected service account home.')
    if RUNTIME.exists():
        raise SystemExit('Runtime already exists. Stop both LaunchAgents and review upgrade separately.')
    credentials = json.loads(args.credentials.read_text())
    service = credentials['serviceToken']
    for value in [credentials['relayToken'], credentials['tunnelToken'], service['client_id'], service['client_secret']]:
        if not isinstance(value, str) or not value or '\n' in value or '\r' in value:
            raise SystemExit('Invalid credential input.')
    install_files(source, browser, RUNTIME, home, user, credentials, node, cloudflared)
    print('Installed. Log into daisorelay GUI session to start. No auto-login was enabled.')

if __name__ == '__main__':
    main()
