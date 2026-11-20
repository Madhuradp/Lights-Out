import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':800})
        pg.on('pageerror', lambda e: print('PAGEERR', e))
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/m_play.png')
        await pg.click('[data-tab=career]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/m_career.png', full_page=False)
        await pg.click('[data-tab=driver]'); await pg.wait_for_timeout(300)
        await pg.click('[data-pat=solid]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='shots/m_driver.png')
        await b.close()
asyncio.run(main())
