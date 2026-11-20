import asyncio, sys, json
from playwright.async_api import async_playwright
# orbit shots of the focus car: python3 tools/carshot.py name
VIEWS = {'front34':[[5.5,1.6,3.8],[0,0.45,0]], 'side':[[0,0.9,6.5],[0,0.45,0]], 'rear34':[[-5.5,1.8,-3.5],[0,0.5,0]], 'top':[[0.5,7,0.01],[0,0.3,0]]}
async def main():
    name = sys.argv[1] if len(sys.argv)>1 else 'car'
    q = sys.argv[2] if len(sys.argv)>2 else 'medium'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1100,'height':620})
        pg.on('pageerror', lambda e: print('PAGEERR', e))
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        await pg.evaluate("q=>{localStorage.clear(); localStorage.setItem('lo_cfg', JSON.stringify({mode:'race',circuit:'parco',laps:3,voice:false,quality:q,opponents:5,gridPos:1}))}", q)
        await pg.reload(); await pg.wait_for_timeout(300); await pg.click('#start'); await pg.wait_for_timeout(2500)
        await pg.evaluate("()=>{document.getElementById('hud').style.display='none'}")
        for k,(pos,tgt) in VIEWS.items():
            await pg.evaluate("v=>{const g=window.__lo.G; g.camMode='debug'; g.debugCam={pos:v[0], target:v[1], fov:38}}", [pos,tgt])
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'shots/car_{name}_{k}.png')
        await b.close()
asyncio.run(main())
