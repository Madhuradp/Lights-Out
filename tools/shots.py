import asyncio, sys, json
from playwright.async_api import async_playwright
CIRC = sys.argv[1]; MODE = sys.argv[2] if len(sys.argv)>2 else 'race'; CAMS = (sys.argv[3] if len(sys.argv)>3 else 'cockpit,chase').split(','); SIMT=float(sys.argv[4]) if len(sys.argv)>4 else 14
EXTRA = json.loads(sys.argv[5]) if len(sys.argv)>5 else {}
W,H = (1280,720) if not EXTRA.get('mobile') else (844,390)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':W,'height':H}, has_touch=bool(EXTRA.get('mobile')), is_mobile=bool(EXTRA.get('mobile')), device_scale_factor=1)
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        cfg = {'mode':MODE,'circuit':CIRC,'laps':5,'voice':False,'quality':EXTRA.get('q','medium'),'opponents':11,'gridPos':6,'incidents':'off','weather':EXTRA.get('weather','dry'),'difficulty':'rookie','assist':{'brake':True,'steer':True,'line':EXTRA.get('line','brake'),'tc':True,'abs':True,'autoGear':True}}
        await pg.evaluate("c=>localStorage.setItem('lo_cfg', JSON.stringify(c))", cfg)
        await pg.reload(); await pg.wait_for_timeout(500)
        if EXTRA.get('menu'): await pg.screenshot(path=f'shots/menu_{W}.png')
        await pg.click('#start'); await pg.wait_for_timeout(2500)
        if EXTRA.get('grid'):
            await pg.screenshot(path=f'shots/{CIRC}_{MODE}_grid.png')
        await pg.evaluate("t=>window.__lo.sim(t, g=>({steer:0, throttle: g.race.phase==='racing'?1:0, brake:0, boost:false}))", SIMT)
        if EXTRA.get('rainnow'):
            await pg.evaluate("()=>{const w=window.__lo.G.race.weather; w.rain=0.8; w.wet=0.7;}")
        for cam in CAMS:
            await pg.evaluate("c=>{window.__lo.G.camMode=c}", cam)
            # let it render a few frames while the bot drives
            await pg.evaluate("()=>{window.__lo.input.touch.throttle=1}")
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'shots/{CIRC}_{MODE}_{cam}{"_m" if EXTRA.get("mobile") else ""}.png')
        print('\n'.join(errs[:20]))
        await b.close()
asyncio.run(main())
