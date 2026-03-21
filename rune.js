class RuneSystem {
  constructor(game) {
    this.game = game;
    this.runeData = [
      { id: 'F01', name: 'Mini', lim: 2, chance: 50, desc: '+x0.04', boost: ' Cash, Multiplier' },
      { id: 'F02', name: 'Small', lim: 5, chance: 30, desc: '+x0.02', boost: ' Fragments' },
      { id: 'F03', name: 'Medium', lim: 19.417, chance: 14.85, desc: '+x0.04', boost: ' Rebirth' },
      { id: 'F04', name: 'Large', lim: 46.511, chance: 3, desc: '+x0.1', boost: ' Fragments' },
      { id: 'F05', name: 'Extreme', lim: 133.33, chance: 1.4, desc: '+x0.05', boost: ' Ultra, Energy' },
      { id: 'F06', name: 'Huge', lim: 500, chance: 0.55, desc: '+x0.03', boost: ' Super' },
      { id: 'F07', name: 'Gigantic', lim: 25000, chance: 0.196, desc: '+x0.5', boost:' Fragments' },
      { id: 'F08', name: 'Secret', lim: 1e308, chance: 0.004, desc: '+x0.025', boost: ' All Stats' }
    ];
    
    this.runeInfoData = [
      { name: 'Mini', softcap: 'Softcap at +x1, ^0.5 boost' },
      { name: 'Small', softcap: 'Softcap at +x1, ^0.7 boost, further softcap at +x5, ^0.6 boost' },
      { name: 'Medium', softcap: 'Softcap at +x1, ^0.4 boost' },
      { name: 'Large', softcap: 'Softcap at +x5, ^0.5 boost' },
      { name: 'Extreme', softcap: 'Softcap at +x1, ^0.4 boost' },
      { name: 'Huge', softcap: 'Softcap at +x1, ^0.4 boost' },
      { name: 'Gigantic', softcap: 'Softcap at +x50, ^0.6 boost' },
      { name: 'Secret', softcap: 'Softcap at +x0.2, ^0.5 boost, another softcap at +x0.5, ^0.5 boost' }
    ];
  }

  // Open Rune
  openRune() {
    if (this.game.fragments.lt(5000)) return;
    this.game.fragments = this.game.fragments.sub(new Decimal(5000).mul(this.game.runeBulk));
    console.log("Rune opened!");
    this.rollRune();
    this.game.saveToStorage();
    this.game.updateDisplay();
  }

  rollRune() {
    const bulk = this.game.runeBulk || 1;
    this.game.totalRunesOpened = this.game.totalRunesOpened.add(bulk);
    for (let i = 0; i < bulk; i++) {
        let prob = 1 / Math.random();
        let prevLim = 0;
        prob = prob * this.game.runeLuck
        for (const rune of this.runeData) {
            if (prob > prevLim && prob <= rune.lim) {
                this.game.runes[rune.id] = (this.game.runes[rune.id] || 0) + 1;
                break;
            }
            prevLim = rune.lim;
        }
    }
    this.game.updateRuneEff()
  }

  // New method to select a rune in the info page
  selectRuneItem(element) {
    document.querySelectorAll('.rune-index-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
    this.updateRuneInfoDisplay(element.dataset.rune);
  }

  updateRuneInfoDisplay(runeId) {
    if (!this.game.runeMainView) return;
    
    // Find active rune if none specified
    if (!runeId) {
        const activeItem = document.querySelector('.rune-index-item.active');
        runeId = activeItem ? activeItem.dataset.rune : 'F01';
    }

    const runeIndex = this.runeData.findIndex(r => r.id === runeId);
    if (runeIndex === -1) return;

    const rune = this.runeData[runeIndex];
    const info = this.runeInfoData[runeIndex];
    const count = this.game.runes[rune.id] || 0;

    const titleEl = document.getElementById('runeDetailTitle');
    const idEl = document.getElementById('runeDetailId');
    const descEl = document.getElementById('runeDetailDesc');
    const boostEl = document.getElementById('runeDetailBoosts');
    if (titleEl) {
        titleEl.innerText = `${rune.name} Rune`;
        titleEl.style.color = '#2dd4bf';
    }
    if (idEl) idEl.innerText = `ID: ${rune.id}`;
    if (descEl) descEl.innerHTML = `Effect: ${rune.desc + rune.boost}<br><span style="color: #facc15; font-size: 0.9em;">${info.softcap}</span>`;
    if (boostEl) {
      let boostHTML = `<div style="font-weight: bold; color: white;">Owned: ${count}</div>`;
      if (runeId =="F02" || runeId == "F04" || runeId == "F07") {
        boostHTML = boostHTML + `<br><div style="font-weight: bold; color: white;">Total Effect: +x${notationChooser(this.game.runeeff[runeId])} Fragments</div>`;
        boostHTML = boostHTML + `<br><div style="font-weight: bold; color: white;">Total Fragment Boost: x${notationChooser(this.game.runeeff["F02"] + this.game.runeeff["F04"] + this.game.runeeff["F07"] + 1)} Fragments, the ${runeId} Rune is contributing ${notationChooser((this.game.runeeff[runeId]/ (this.game.runeeff["F02"] + this.game.runeeff["F04"] + this.game.runeeff["F07"]))*100)}% of the Total Fragment Boost</div>`;
      } else {
        boostHTML = boostHTML + `<br><div style="font-weight: bold; color: white;">Total Effect: x${notationChooser(this.game.runeeff[runeId])} ${rune.boost}</div>`;
      }
      boostEl.innerHTML = boostHTML
    }
  }
}
