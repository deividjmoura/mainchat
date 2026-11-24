#!/usr/bin/env python3
"""Gera assets/certificado-caca.pdf (A4) a partir do mesmo design do certificado.

Uso:
    python3 -m venv .venv && .venv/bin/pip install reportlab pymupdf
    .venv/bin/python tools/generate-cert.py

Não é etapa de build do site — o PDF já vem pronto em assets/.
Rode de novo só se quiser mudar textos, cores ou a data de emissão.
"""
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import Color, HexColor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'tools', 'fonts')  # TTFs convertidos dos pacotes @fontsource (OFL)
OUT = os.path.join(ROOT, 'assets', 'certificado-caca.pdf')

# ---- textos do certificado (mesma fonte da verdade: config.js) ----
APELIDO = 'Caca'
ASSINANTE = 'Deivid de Moura'
ASSINANTE_COMPLETO = 'Deivid de Jesus de Moura'
EMISSAO = '24 de novembro de 2026'

# ---- paleta (idêntica ao CSS do certificado) ----
WINE = HexColor('#5A1230')
ROSE = HexColor('#F8E6E3')
GOLD = HexColor('#B8893B')
GOLD_HI = HexColor('#E6C77F')
GOLD_LO = HexColor('#9C7128')
PLUM = HexColor('#2A0F24')
PLUM_HI = HexColor('#4A1A3D')
INK = HexColor('#3A1A28')

PAGE_W, PAGE_H = A4
MID_X = PAGE_W / 2

for name, path in {
    'Cormorant': 'CormorantGaramond-Medium.ttf',
    'Cormorant-SemiBold': 'CormorantGaramond-SemiBold.ttf',
    'Cormorant-Italic': 'CormorantGaramond-MediumItalic.ttf',
    'Allura': 'Allura-Regular.ttf',
    'Mono': 'JetBrainsMono-Regular.ttf',
}.items():
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, path)))


def bg_gradient(c):
    """Fundo em degradê radial ameixa: centro claro (topo) -> bordas escuras. Imita
    radial-gradient(ellipse at 50% 0%, #4A1A3D 0%, #2A0F24 60%)."""
    c.setFillColor(PLUM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    steps = 110
    cx, cy = MID_X, PAGE_H
    for i in range(steps, 0, -1):
        t = i / steps  # 1 = borda externa, ->0 = centro
        k = t ** 1.35
        col = Color(
            PLUM_HI.red + (PLUM.red - PLUM_HI.red) * k,
            PLUM_HI.green + (PLUM.green - PLUM_HI.green) * k,
            PLUM_HI.blue + (PLUM.blue - PLUM_HI.blue) * k,
        )
        c.setFillColor(col)
        rx = PAGE_W * 1.30 * t + PAGE_W * 0.06
        ry = PAGE_H * 1.02 * t + PAGE_H * 0.06
        c.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, stroke=0, fill=1)


def text_width(text, font, size, tracking=0.0):
    return pdfmetrics.stringWidth(text, font, size) + tracking * max(0, len(text) - 1)


def draw_tracked(c, text, x, y, font, size, color, tracking=0.0):
    c.setFont(font, size)
    c.setFillColor(color)
    if tracking == 0:
        c.drawCentredString(x, y, text)
        return
    total = text_width(text, font, size, tracking)
    cursor = x - total / 2
    for ch in text:
        c.drawString(cursor, y, ch)
        cursor += pdfmetrics.stringWidth(ch, font, size) + tracking


def wrap_runs(runs, max_width, size):
    """runs: list[(texto, font)] -> lista de linhas, cada uma lista de (palavra, font, largura)."""
    words = []
    space_w = {}
    for text, font in runs:
        for w in text.split(' '):
            if w:
                words.append((w, font))
    for font in {'Cormorant', 'Cormorant-SemiBold'}:
        space_w[font] = pdfmetrics.stringWidth(' ', font, size)
    lines, cur, cur_w = [], [], 0.0
    for w, font in words:
        w_w = pdfmetrics.stringWidth(w, font, size)
        add = w_w if not cur else w_w + space_w.get(cur[-1][1], pdfmetrics.stringWidth(' ', 'Cormorant', size))
        if cur and cur_w + add > max_width:
            lines.append(cur)
            cur, cur_w = [(w, font, w_w)], w_w
        else:
            cur.append((w, font, w_w))
            cur_w += add
    if cur:
        lines.append(cur)
    # reagrupa como (texto, font) contínuo por linha
    out_lines = []
    for line in lines:
        merged, buf, buf_font = [], '', line[0][1]
        for w, font, _ in line:
            if font != buf_font:
                merged.append((buf.rstrip(), buf_font))
                buf, buf_font = w + ' ', font
            else:
                buf += w + ' '
        merged.append((buf.rstrip(), buf_font))
        out_lines.append(merged)
    return out_lines


def line_width(runs, size):
    w = 0.0
    for i, (text, font) in enumerate(runs):
        w += pdfmetrics.stringWidth(text, font, size)
        if i:
            w += pdfmetrics.stringWidth(' ', 'Cormorant', size)  # espaço entre runs é aproximado
    return w


def draw_rich_centered(c, runs, cx, y, size, color_map):
    total = 0.0
    parts = []
    for text, font in runs:
        seg = text + (' ' if text is runs[-1][0] else '')
        w = pdfmetrics.stringWidth(text, font, size)
        parts.append((text, font, w))
        total += w
    spaces = pdfmetrics.stringWidth(' ', 'Cormorant', size)

    def gap_before(text):
        return 0.0 if text[:1] in '.,;:!?)]' else spaces

    total = parts[0][2] + sum(gap_before(t) + w for t, _, w in parts[1:])
    x = cx - total / 2
    for i, (text, font, w) in enumerate(parts):
        if i:
            x += gap_before(text)
        c.setFont(font, size)
        c.setFillColor(color_map.get(font, INK))
        c.drawString(x, y, text)
        x += w


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    c = canvas.Canvas(OUT, pagesize=A4)
    c.setTitle('Certificado de Aprovação · Caca')
    c.setAuthor(ASSINANTE_COMPLETO)
    c.setSubject('Certificado de Aprovação — Curso de lógica de programação, módulo coração')

    bg_gradient(c)

    # ---- cartão ----
    card_w, card_h = 462, 648
    card_x, card_y = (PAGE_W - card_w) / 2, (PAGE_H - card_h) / 2 - 6
    c.setFillColor(ROSE)
    c.rect(card_x, card_y, card_w, card_h, stroke=0, fill=1)
    # borda dupla dourada (imita "3px double")
    c.setStrokeColor(GOLD)
    c.setLineWidth(3.1)
    c.rect(card_x + 1.6, card_y + 1.6, card_w - 3.2, card_h - 3.2, stroke=1, fill=0)
    c.setLineWidth(1.15)
    c.rect(card_x + 6.2, card_y + 6.2, card_w - 12.4, card_h - 12.4, stroke=1, fill=0)
    # filete interno vinho (o ::before do CSS)
    c.setStrokeColor(WINE)
    c.setStrokeAlpha(0.55)
    c.setLineWidth(0.8)
    c.rect(card_x + 11.5, card_y + 11.5, card_w - 23, card_h - 23, stroke=1, fill=0)
    c.setStrokeAlpha(1)

    top = card_y + card_h
    y = top - 64
    draw_tracked(c, 'Certificado de Aprovação', MID_X, y, 'Cormorant-SemiBold', 32.5, WINE, tracking=0.2)
    y -= 24
    draw_tracked(c, 'Curso de lógica de programação, módulo coração', MID_X, y, 'Cormorant-Italic', 16, INK)

    # pílula de status
    y -= 44
    pill_text = '// status: aprovada com louvor'
    pill_font, pill_size = 'Mono', 8.6
    text_w = pdfmetrics.stringWidth(pill_text, pill_font, pill_size)
    check_w = 12
    pill_w = text_w + check_w + 30
    pill_h = 21
    pill_cy = y - 6.2 + pill_size / 2 - 1
    c.setFillColor(WINE)
    c.roundRect(MID_X - pill_w / 2, pill_cy - pill_h / 2, pill_w, pill_h, 10.5, stroke=0, fill=1)
    c.setFillColor(ROSE)
    c.setFont(pill_font, pill_size)
    c.drawString(MID_X - pill_w / 2 + 15, y - 6.2, pill_text)
    # ✔ desenhado (a fonte não tem o glifo)
    check_x = MID_X - pill_w / 2 + 15 + text_w + 7
    c.setStrokeColor(ROSE)
    c.setLineWidth(1.6)
    c.setLineCap(1)
    c.setLineJoin(1)
    p = c.beginPath()
    p.moveTo(check_x, pill_cy + 0.4)
    p.lineTo(check_x + 3.2, pill_cy - 2.6)
    p.lineTo(check_x + 8.6, pill_cy + 3.6)
    c.drawPath(p, stroke=1, fill=0)

    y -= 42
    draw_tracked(c, 'Concedido a', MID_X, y, 'Cormorant-Italic', 17, INK)
    y -= 72
    draw_tracked(c, APELIDO, MID_X, y, 'Allura', 92, WINE)

    # corpo com trechos em negrito vinho
    body_size, line_h = 17.5, 25
    body_runs = [
        ('Depois de resolver todos os desafios, e de rever tantas caretas pelo caminho, eu, ', 'Cormorant'),
        (ASSINANTE_COMPLETO, 'Cormorant-SemiBold'),
        (', confirmo que a titular possui ', 'Cormorant'),
        ('habilidades e beleza', 'Cormorant-SemiBold'),
        (' mais que suficientes para se tornar ', 'Cormorant'),
        ('minha namorada', 'Cormorant-SemiBold'),
        ('.', 'Cormorant'),
    ]
    max_w = card_w - 88
    y -= 30
    for line in wrap_runs(body_runs, max_w, body_size):
        draw_rich_centered(c, line, MID_X, y, body_size, {'Cormorant-SemiBold': WINE, 'Cormorant': INK})
        y -= line_h

    # linha dourada + cláusula
    y -= 6
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.9)
    c.line(MID_X - 95, y, MID_X + 95, y)
    y -= 20
    clause_size, clause_lh = 13.6, 19
    clause_runs = [
        ('Este certificado é um convite e só vale mediante aceite da titular, que pode responder com calma, quando e como preferir. Validade: indefinida.', 'Cormorant-Italic'),
    ]
    for line in wrap_runs(clause_runs, max_w, clause_size):
        draw_rich_centered(c, line, MID_X, y, clause_size, {'Cormorant-Italic': INK})
        y -= clause_lh

    # rodapé: assinatura à esquerda, selo à direita
    foot_y = card_y + 74
    sig_w = 225
    sig_x = card_x + 46
    c.setFillColor(WINE)
    c.setFont('Allura', 29)
    c.drawString(sig_x, foot_y + 26, ASSINANTE)
    c.setStrokeColor(INK)
    c.setLineWidth(0.9)
    c.setStrokeAlpha(0.85)
    c.line(sig_x, foot_y + 21, sig_x + sig_w, foot_y + 21)
    c.setStrokeAlpha(1)
    c.setFillColor(INK)
    c.setFont('Cormorant', 9.5)
    c.drawString(sig_x, foot_y + 7, f'Emitido em {EMISSAO}')

    seal_cx, seal_cy, seal_r = card_x + card_w - 78, foot_y + 18, 41
    c.saveState()
    c.translate(seal_cx, seal_cy)
    c.rotate(-8)
    # selo com degradê radial dourado (círculos concêntricos)
    steps = 40
    for i in range(steps, 0, -1):
        t = i / steps
        col = Color(
            GOLD_LO.red + (GOLD_HI.red - GOLD_LO.red) * (1 - t ** 1.5),
            GOLD_LO.green + (GOLD_HI.green - GOLD_LO.green) * (1 - t ** 1.5),
            GOLD_LO.blue + (GOLD_HI.blue - GOLD_LO.blue) * (1 - t ** 1.5),
        )
        c.setFillColor(col)
        c.circle(0, 0, seal_r * t, stroke=0, fill=1)
    c.setStrokeColor(WINE)
    c.setLineWidth(1.1)
    c.setDash([2.4, 2.4], 0)
    c.circle(0, 0, seal_r - 7.5, stroke=1, fill=0)
    c.setDash([], 0)
    c.setFillColor(WINE)
    c.setFont('Mono', 19)
    c.drawCentredString(0, -6.5, '<3')
    c.restoreState()

    c.showPage()
    c.save()
    print('PDF gerado em', OUT, f'({os.path.getsize(OUT)//1024} KB)')


if __name__ == '__main__':
    sys.exit(main())
