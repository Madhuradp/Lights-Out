import asyncio, sys, json
from playwright.async_api import async_playwright
# world-space shots along a circuit: python3 tools/trackshot.py circuit "s,side,height,ahead[,lookSide]" ... [--q=high]
# camera at distance s along the lap, `side` metres left of centre, `height` up, looking at the point `ahead` metres further on
async def main():
    circ = sys.argv[1]; views = [a for a in sys.argv[2:] if not a.startswith('--')]
    q = next((a[4:] for a in sys.argv if a.startswith('--q=')), 'medium')
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1100,'height':620})
        pg.on('pageerror', lambda e: print('PAGEERR', e))
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        await pg.evaluate("v=>{localStorage.clear(); localStorage.setItem('lo_cfg', JSON.stringify({mode:'race',circuit:v[0],laps:3,voice:false,quality:v[1],opponents:5,gridPos:1}))}", [circ, q])
        await pg.reload(); await pg.wait_for_timeout(300); await pg.click('#start'); await pg.wait_for_timeout(2500)
        await pg.evaluate("()=>{document.getElementById('hud').style.display='none'}")
        for k, v in enumerate(views):
            s, side, h, ahead, *rest = [float(x) for x in v.split(',')]
            look = rest[0] if rest else 0
            await pg.evaluate("""v=>{const g=window.__lo.G, T=g.T; const a={}, b={}; T.at(v[0], a); T.at(v[0]+v[3], b);
              g.camMode='debug'; g.debugCam={world:true, fov:55, pos:[a.x+a.nx*v[1], a.y+v[2], a.z+a.nz*v[1]], target:[b.x+b.nx*v[4], b.y+1, b.z+b.nz*v[4]]}}""", [s, side, h, ahead, look])
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'shots/track_{circ}_{k}.png')
        await b.close()
asyncio.run(main())
