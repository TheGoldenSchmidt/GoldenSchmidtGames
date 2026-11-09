import {test,expect} from '@playwright/test';
import {partyMiniResults} from '../../shared/party';
import {onlineSession,toMini} from './party-session';

for(const motion of ['no-preference','reduce'] as const)test(`Trophäenziel, Übungsziele und Münzbelohnung (${motion})`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:motion});
  const session=await onlineSession(page,true);
  try {
    const viewer=await page.evaluate(()=>JSON.parse(localStorage.getItem('spielraum.profile.v1')!).id as string);
    const goal=page.getByRole('complementary',{name:'Dein Trophäenziel'});
    await expect(goal).toContainText('Noch 10 Münzen bis zum Trophäenkauf');
    await expect(goal).toContainText('Feld 6');
    await expect(goal.getByRole('meter')).toHaveAttribute('value','10');
    await page.getByText('Die 3D-Minispiele ausprobieren',{exact:true}).click();
    await page.getByRole('button',{name:/^Kistenkrawall/}).click();
    const dialog=page.getByRole('dialog'),goals=dialog.getByRole('region',{name:'Lernziele der Übung'});
    await expect(goals.getByLabel('Bewege deine Figur: offen')).toBeVisible();
    await expect(dialog.locator('.party-action-world')).toHaveAttribute('data-webgl','ready');
    await expect(dialog.locator('.party-action-countdown')).toHaveCount(0,{timeout:10000});
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');
    await expect(goals.getByLabel('Bewege deine Figur: geschafft')).toBeVisible();
    await page.keyboard.press('Space');await page.keyboard.press('e');
    await expect(goals).toContainText('Lernziele geschafft!');
    await page.screenshot({path:info.outputPath('practice-goals.png'),fullPage:false});
    // Practice UI does not award coins to the authoritative online player.
    expect((await session.state()).partyGame!.players.find(p=>p.id===viewer)!.coins).toBe(10);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
    await toMini(session);
    for(const id of session.ids)await session.action({type:'ready'},id);
    await expect(page.locator('.party-action-countdown')).toHaveCount(0,{timeout:10000});
    await session.control(viewer,{x:.2,z:0,jump:false,punch:false},100);
    await page.waitForTimeout(200);
    for(const id of session.ids)await session.action({type:'finish'},id);
    await expect(page.locator('.party-mini-results')).toBeVisible();
    const game=(await session.state()).partyGame!,result=partyMiniResults(game).find(r=>r.player.id===viewer)!;
    expect(result.coins).toBeGreaterThan(0);
    await expect(page.locator('.party-coin-reward')).toContainText(`+${result.coins} Münzen`);
    await expect(page.locator('.party-coin-reward')).toContainText(`jetzt ${result.player.coins}`);
    await page.screenshot({path:info.outputPath('coin-reward.png'),fullPage:false});
    await session.action({type:'next'});
    await expect(goal).toContainText(`+${result.coins} Münzen aus dem Minispiel`);
    await expect(goal.getByRole('meter')).toHaveAttribute('value',String(Math.min(20,result.player.coins)));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('trophy-goal.png'),fullPage:false});
  }finally{session.close();}
});
