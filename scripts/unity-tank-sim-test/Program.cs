using System;
using System.Linq;
using System.Numerics;
using GSG.Tanks;

static void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

static void Advance(TankSim sim, int ms)
{
    for (int i = 0; i < ms && !sim.Done; i += TankSim.StepMs) sim.Step(default, default, false);
}

static TankSim Fixture()
{
    var sim = new TankSim(2, 5);
    foreach (var wall in sim.Walls)
    {
        var c = wall.Center;
        if (c.X > 0.1f && c.Y > 0.1f && c.X < TankSim.Width - 0.1f && c.Y < TankSim.Height - 0.1f) wall.Kind = 0;
    }
    sim.Tanks[0].Position = new Vector2(2f, 8f);
    sim.Tanks[0].ShieldUntil = 0;
    sim.Tanks[1].Life = 0;
    sim.Tanks[1].RespawnAt = int.MaxValue;
    return sim;
}

var maze = new TankSim(2, 5);
// Same seed and edge layout as createMatch("tanks", …, 5).
const string horizontal = "111111111200000100120020110100100100100000100000001010000010000200012002012101111111";
const string vertical = "1000020110002011100000011100000110012001102220011021002110000101100221011000000110000001";
Check(string.Concat(maze.Walls.Select(w => w.Kind)) == horizontal + vertical, "Das Unity-Labyrinth stimmt mit dem Web-Labyrinth überein");

var bricks = Fixture();
var brick = bricks.Walls.Single(w => Vector2.Distance(w.Center, new Vector2(4.8f, 8.8f)) < 0.01f);
brick.Kind = 2;
bricks.Tanks[0].Position = new Vector2(3.6f, 8.8f);
bricks.Step(default, Vector2.UnitX, true);
Advance(bricks, 500);
Check(brick.Kind == 3 && bricks.Bullets.Count == 0, "Erste Kugel wird von der Ziegelwand verbraucht");
bricks.Step(default, default, true);
Advance(bricks, 500);
Check(brick.Kind == 0 && bricks.Bullets.Count == 0, "Zweite Kugel öffnet einen Weg");

var bounce = Fixture();
bounce.Tanks[0].Position = new Vector2(5.6f, 3f);
bounce.Step(default, Vector2.UnitX, true);
var bullet = bounce.Bullets.Single();
bounce.Tanks[0].Position = new Vector2(5.6f, 10f);
Advance(bounce, 4700);
Check(bullet.Bounces == 3 && bounce.Bullets.Count == 0, "Die Kugel verschwindet am dritten Wandkontakt");

var self = Fixture();
self.Tanks[0].Position = new Vector2(5.6f, 1.3f);
self.Tanks[0].Life = 1;
self.Step(default, -Vector2.UnitY, true);
Advance(self, 600);
Check(!self.Tanks[0].Alive && self.Tanks[0].Deaths == 1 && self.Tanks[0].Kills == 0, "Eigentreffer zählt nicht als Abschuss");
Advance(self, TankSim.Respawn);
Check(self.Tanks[0].Life == TankSim.Hp && self.Protected(self.Tanks[0]), "Wiedereinstieg mit drei HP und Schild");

var powers = Fixture();
powers.Pickups.Add((int.MaxValue, TankSim.Power.Triple, powers.Tanks[0].Position));
powers.Step(default, default, false);
powers.Step(default, Vector2.UnitX, true);
Check(powers.Bullets.Count == 3 && powers.Bullets.Count(b => !b.Extra) == 1, "Dreifachschuss belegt einen Schussplatz");
powers.Step(default, Vector2.UnitX, true);
Check(powers.Bullets.Count == 3, "Abklingzeit verhindert einen zweiten Dreifachschuss");

var win = Fixture();
win.Tanks[0].Kills = TankSim.KillsToWin - 1;
win.Tanks[1].Position = new Vector2(3.2f, 8f);
win.Tanks[1].ShieldUntil = 0;
win.Tanks[1].Life = 1;
win.Step(default, Vector2.UnitX, true);
Advance(win, 300);
Check(win.Done && win.Winner == 0, "Siebter Abschuss beendet die Runde");

var tie = Fixture();
Advance(tie, TankSim.Regular);
Check(tie.InOvertime && !tie.Done, "Gleichstand nach 90 Sekunden führt ins Stechen");
Advance(tie, TankSim.Overtime);
Check(tie.Done && tie.Winner == -1, "Stechen endet nach 30 Sekunden unentschieden");

var bots = new TankSim(4, 7);
Advance(bots, TankSim.Regular + TankSim.Overtime);
Check(bots.Done && bots.Tanks.Sum(t => t.Kills) > 0, "Die Bots finden und bekämpfen sich in einer vollständigen Runde");

Console.WriteLine("Unity Tank Trouble: Labyrinth, Mauerbruch, Abpraller, Eigentreffer, Wiedereinstieg, Extras, Sieg, Stechen und Bots erfolgreich.");
