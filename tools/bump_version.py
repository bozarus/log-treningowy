#!/usr/bin/env python3
"""Ustawia ten sam numer wersji w app/config.js i app/sw.js. Użycie: python3 tools/bump_version.py 2026.10.01-1"""
import re, sys, pathlib
v = sys.argv[1]
root = pathlib.Path(__file__).resolve().parent.parent / 'app'
c = (root / 'config.js').read_text(encoding='utf-8')
c = re.sub(r"version: '[^']*'", "version: '%s'" % v, c, count=1)
(root / 'config.js').write_text(c, encoding='utf-8')
s = (root / 'sw.js').read_text(encoding='utf-8')
s = re.sub(r"var VERSION = '[^']*';", "var VERSION = 'lt-%s';" % v, s, count=1)
(root / 'sw.js').write_text(s, encoding='utf-8')
print('Wersja ustawiona na', v)
