#!/usr/bin/env python3
"""Execution Engine server — serves PWA + JSON API for widget sync."""
import os
import json
import http.server
import socketserver
from urllib.parse import urlparse

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DATA_DIR, 'data.json')
os.chdir(DATA_DIR)


def load_data():
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


class EngineHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
    }

    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/api/today':
            self.send_api_response(self.get_today())
        elif path == '/api/state':
            self.send_api_response(load_data())
        elif path == '/api/widget':
            self.send_api_response(self.get_widget_data())
        else:
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path

        if path == '/api/sync':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                save_data(data)
                self.send_api_response({'status': 'ok'})
            except json.JSONDecodeError:
                self.send_error(400, 'Invalid JSON')
        else:
            self.send_error(404)

    def get_today(self):
        from datetime import date
        today_key = date.today().isoformat()
        data = load_data()
        days = data.get('days', {})
        return days.get(today_key, {})

    def get_widget_data(self):
        from datetime import date, timedelta
        today_key = date.today().isoformat()
        data = load_data()
        days = data.get('days', {})
        today_data = days.get(today_key, {})

        tasks = today_data.get('tasks', [])
        big_task = next((t for t in tasks if t.get('tier') == 'big'), None)
        med_tasks = [t for t in tasks if t.get('tier') == 'med']
        done_count = sum(1 for t in tasks if t.get('status') == 'done')
        total_count = len(tasks)

        # Weekly completion
        week_done = 0
        week_total = 0
        for i in range(7):
            d = (date.today() - timedelta(days=i)).isoformat()
            day_data = days.get(d, {})
            for t in day_data.get('tasks', []):
                week_total += 1
                if t.get('status') == 'done':
                    week_done += 1

        return {
            'date': today_key,
            'bigTask': big_task.get('name', '') if big_task else '',
            'bigTaskDone': big_task.get('status') == 'done' if big_task else False,
            'medTasks': [{'name': t.get('name', ''), 'done': t.get('status') == 'done'} for t in med_tasks],
            'energy': today_data.get('energy', ''),
            'ocdImpact': today_data.get('ocdImpact', ''),
            'recoveryLevel': today_data.get('recoveryLevel', 0),
            'todayDone': done_count,
            'todayTotal': total_count,
            'weekPct': round(week_done / week_total * 100) if week_total > 0 else 0,
        }

    def send_api_response(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Silence logs


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with ReusableTCPServer(("0.0.0.0", 8080), EngineHandler) as httpd:
        httpd.serve_forever()
