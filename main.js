// Global Shims for NumberFormat.js
window.player = {};
window.options = {
  notation: 'mixed scientific'
};
window.modInfo = {
    allowSmall: true
};

// === CONSTANTS ===

// Tab identifiers used for data-driven tab switching
const TABS = ['stats', 'tier', 'energy', 'fragments', 'achievements', 'tokens', 'index', 'options'];

// Achievement unlock conditions (checked every tick)
const ACHIEVEMENT_DEFS = [
  { key: 'goodStart',         check: g => g.multiplier.gte(3) },
  { key: 'firstRebirth',      check: g => g.rebirthCount.gte(1) },
  { key: 'rebirthEngine',     check: g => g.rebirthCount.gte(5) },
  { key: 'kilowatt',          check: g => g.energy.gte(1000) },
  { key: 'upgradedProduction', check: g => g.energyUpgrades.some(u => u) },
  { key: 'ultraMomentum',     check: g => g.ultra.gte(10) },
  { key: 'supercharged',      check: g => g.super.gte(3) },
  { key: 'superfragment',     check: g => g.super.gte(10) },
  { key: 'kilofrag',          check: g => g.fragments.gte(1000) },
];

// Achievement stat bonuses: which stats each unlocked achievement boosts
const ACHIEVEMENT_BONUSES = [
  { key: 'goodStart',         effects: { cashBonus: 1.03 } },
  { key: 'firstRebirth',      effects: { multGainBonus: 1.05 } },
  { key: 'rebirthEngine',     effects: { rebirthGainBonus: 1.05 } },
  { key: 'kilowatt',          effects: { cashBonus: 1.10 } },
  { key: 'upgradedProduction', effects: { energyBonus: 1.05 } },
  { key: 'ultraMomentum',     effects: { cashBonus: 1.01, multGainBonus: 1.01, rebirthGainBonus: 1.01, ultraGainBonus: 1.01 } },
  { key: 'kilofrag',          effects: { superBonus: 1.1 } },
  { key: 'superfragment',     effects: { fragmentBonus: 1.1 } },
  { key: 'supercharged',      effects: { multGainBonus: 1.10 } },
];

// Minimum tier required for each energy upgrade (by index)
const ENERGY_UPGRADE_TIER_REQ = [3, 3, 4, 4, 5, 5, 6, 7, 8];
const ENERGY_UPGRADE_COSTS = [4000, 10000, 25000, 50000, 150000, 400000, 750000, 2500000];
const ENERGY_UPGRADE_LABELS = ['4,000', '10,000', '25,000', '50,000', '150,000', '400,000', '750,000', '2.5M'];

// Tier-up requirement text displayed on the Tier tab
const TIER_REQ_TEXT = [
  'Cost: 10 Multiplier',
  'Cost: 3 Rebirths',
  'Cost: 20 Rebirths',
  'Cost: 10 Ultra',
  'Cost: 2 Super',
  'Cost: 70 Ultra OR 5 Super',
  "Cost: 10 'Energy Boost' and 6 'Bigger and Better' fragment upgrades",
  "Cost: 2,000,000 Fragments",
];

// Shared default values for runes and achievements (used by constructor and hardReset)
const DEFAULT_RUNES = { F01: 0, F02: 0, F03: 0, F04: 0, F05: 0, F06: 0, F07: 0, F08: 0 };
const DEFAULT_RUNE_EFF = { F01: 1, F02: 0, F03: 1, F04: 0, F05: 1, F06: 1, F07: 0, F08: 1 };
const DEFAULT_ACHIEVEMENTS = {
  goodStart: false, firstRebirth: false, rebirthEngine: false,
  kilowatt: false, upgradedProduction: false, ultraMomentum: false,
  supercharged: false, kilofrag: false, superfragment: false
};

// === HELPER FUNCTIONS ===

// Simple power softcap: if value > threshold, apply power to the whole value
function softcap(value, threshold, power) {
  return value > threshold ? value ** power : value;
}

// Offset softcap: if value > threshold, power-scale only the excess above (threshold-1)
function offsetSoftcap(value, threshold, power) {
  const offset = threshold - 1;
  return value > threshold ? ((value - offset) ** power) + offset : value;
}

// === GAME CLASS ===

class StatGrindingGame {

  // initialisation
  constructor() {
    this.cash = new Decimal(0);
    this.ttlcash = new Decimal(0);
    this.multiplier = new Decimal(0);
    this.rebirthCount = new Decimal(0);
    this.tier = 0; 
    this.multiplierBonus = new Decimal(1);
    this.cashBonus = new Decimal(1);
    this.fragmentMult = new Decimal(1);
    this.fragmentBonus = new Decimal(1);
    this.ultra = new Decimal(0);
    this.super = new Decimal(0);
    this.energy = new Decimal(0);
    this.hyper = new Decimal(0);
    this.timeToken = new Decimal(300);
    this.superBonus = new Decimal(1);
    this.energyUpgrades = [false, false, false, false, false, false, false, false, false, false, false, false];
    this.playTime = 0;
    this.baseIncome = new Decimal(0.5); 
    this.tickInterval = 50;
    this.energyTimer = 0; 
    this.fragments = new Decimal(0);
    this.shards = [];
    this.fragmentSpawnTimer = 0;
    this.fragmentUpgradesPurchased = [0, 0, 0, 0, 0, 0, 0, 0];
    this.tokens = 0;
    this.tokenUpgrades = [0, 0, 0, 0, 0, 0, 0, 0];
    this.runes = {
      F01: 0,
      F02: 0,
      F03: 0,
      F04: 0,
      F05: 0,
      F06: 0,
      F07: 0,
      F08: 0
    };
    this.runeeff = {
      F01: 1,
      F02: 0,
      F03: 1,
      F04: 0,
      F05: 1,
      F06: 1,
      F07: 0,
      F08: 1
    }
    this.totalRunesOpened = new Decimal(0);
    this.runeSpeed = 1;
    this.runeBulk = 1;
    this.runeLuck = 1;
    this.ttlcash = new Decimal(0);
    this.lastDailyRewardTime = 0;
    this.currentStreak = 0;
    this.highestStreak = 0;
    this.runeSystem = new RuneSystem(this);
    this.backgroundMusic = 'signal';
    this.backgroundAudio = null;
    this.musicRetryTimeout = null;

    this.achievements = {
      goodStart: false,  
      firstRebirth: false,       
      rebirthEngine: false,      
      kilowatt: false,           
      upgradedProduction: false, 
      ultraMomentum: false,      
      supercharged: false,
      kilofrag: false,
      superfragment: false
    };
    
    // DOM elements
    this.cashDisplay = document.getElementById('cashDisplay');
    this.multiplierDisplay = document.getElementById('multiplierDisplay');
    this.rebirthDisplay = document.getElementById('rebirthDisplay');
    this.ultraDisplay = document.getElementById('ultraDisplay');
    this.superDisplay = document.getElementById('superDisplay');
    this.hyperDisplay = document.getElementById('hyperDisplay');
    this.statsTab = document.getElementById('statsTab');
    this.tierTab = document.getElementById('tierTab');
    this.energyTab = document.getElementById('energyTab');
    this.fragmentsTab = document.getElementById('fragmentsTab');
    this.achievementsTab = document.getElementById('achievementsTab');
    this.tokensTab = document.getElementById('tokensTab');
    this.indexTab = document.getElementById('indexTab');
    this.optionsTab = document.getElementById('optionsTab');
    this.statsContent = document.getElementById('statsContent');
    this.tierContent = document.getElementById('tierContent');
    this.energyContent = document.getElementById('energyContent');
    this.fragmentsContent = document.getElementById('fragmentsContent');
    this.achievementsContent = document.getElementById('achievementsContent');
    this.tokensContent = document.getElementById('tokensContent');
    this.indexContent = document.getElementById('indexContent');
    this.tierDisplay = document.getElementById('tierDisplay');
    this.tierReq = document.getElementById('tierReq');
    this.tierUpBtn = document.getElementById('tierUpBtn');
    this.optionsContent = document.getElementById('optionsContent');
    this.creditsContent = document.getElementById('creditsContent');
    this.runeRarity = document.getElementById('runeRarity');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.importText = document.getElementById('importText');
    this.hardResetBtn = document.getElementById('hardResetBtn');
    this.creditsBtn = document.getElementById('creditsBtn');
    this.backBtn = document.getElementById('backBtn');
    this.playTimeDisplay = document.getElementById('playTimeDisplay');
    this.notationSelect = document.getElementById('notationSelect');
    this.musicSelect = document.getElementById('musicSelect');
    this.fragmentDisplay = document.getElementById('fragmentDisplay');
    this.fragmentUpgradeBtn = document.getElementById('fragmentUpgradeBtn'); 
    this.fragmentCanvas = document.getElementById('fragmentCanvas');
    this.ctx = this.fragmentCanvas ? this.fragmentCanvas.getContext('2d') : null;
    
    // Tokens Tab DOM
    this.tokenDisplay = document.getElementById('tokenDisplay');
    this.tokenTimer = document.getElementById('tokenTimer');
    this.currentStreakDisplay = document.getElementById('currentStreak');
    this.highestStreakDisplay = document.getElementById('highestStreak');
    this.rewardTimer = document.getElementById('rewardTimer');
    this.rewardTimerLabel = document.getElementById('rewardTimerLabel');
    this.nextRewardAmount = document.getElementById('nextRewardAmount');
    this.claimRewardBtn = document.getElementById('claimRewardBtn');
    this.claimLockedMsg = document.getElementById('claimLockedMsg');
    
    if (this.fragmentCanvas) {
        this.initFragmentInteraction();
    }
    
    this.energyDisplay = document.getElementById('energyDisplay');
    this.energyPerSec = document.getElementById('energyPerSec');
    this.energyCashBoost = document.getElementById('energyCashBoost');
    this.energyMultBoost = document.getElementById('energyMultBoost');
    this.energyRebirthBoost = document.getElementById('energyRebirthBoost');
    this.energyProgressBar = document.getElementById('energyProgressBar');
    this.energyTimerText = document.getElementById('energyTimerText');

    this.eUpBtns = Array.from({ length: 8 }, (_, i) =>
      document.getElementById(`eUp${i + 1}`)
    );
    
    this.tUpgBtns = Array.from({ length: 8 }, (_, i) =>
      document.getElementById(`tUpg${i}`)
    );
    
    this.indexDetailTitle = document.getElementById('indexDetailTitle');
    this.indexDetailId = document.getElementById('indexDetailId');
    this.indexDetailDesc = document.getElementById('indexDetailDesc');
    this.tierUpReset = document.getElementById('tierUpReset');
    this.indexDetailBoosts = document.getElementById('indexDetailBoosts');
    
    // Rune Opening Logic
    this.openRuneBtn = document.getElementById('openRuneBtn');
    this.holdProgress = document.getElementById('holdProgress');
    this.runesContainer = document.getElementById('runesContainer');
    this.runeList = document.getElementById('runeList');
    this.optTotalRunes = document.getElementById('optTotalRunes');
    this.optRuneBulk = document.getElementById('optRuneBulk');
    this.optRuneLuck = document.getElementById('optRuneLuck');
    this.optRuneSpeed = document.getElementById('optRuneSpeed');
    this.optTtlCash = document.getElementById('optTtlCash');
    
    this.isHoldingRune = false;
    this.runeHoldTime = 0;
    this.runeHoldThreshold = 1000; // 1 second hold
    
    if (this.openRuneBtn) {
        this.openRuneBtn.addEventListener('mousedown', () => {
            if (this.fragments.lt(5000)) return;
            this.isHoldingRune = true;
        });

        this.openRuneBtn.addEventListener('touchstart', (e) => {
            if (this.fragments.lt(5000)) return;
            this.isHoldingRune = true;
            e.preventDefault();
        });

        ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
            this.openRuneBtn.addEventListener(evt, () => {
                this.isHoldingRune = false;
                this.runeHoldTime = 0;
                if (this.holdProgress) this.holdProgress.style.width = '0%';
            });
        });
    }

    // Index Sub-tabs
    this.statIndexPageBtn = document.getElementById('statIndexTab');
    this.runeIndexPageBtn = document.getElementById('runeIndexTab');
    this.indexMainView = document.getElementById('indexMainView');
    this.runeMainView = document.getElementById('runeMainView');

    if (this.statIndexPageBtn) {
        this.statIndexPageBtn.addEventListener('click', () => this.switchIndexPage('stats'));
    }
    if (this.runeIndexPageBtn) {
        this.runeIndexPageBtn.addEventListener('click', () => this.switchIndexPage('runes'));
    }

    this.statsTab.addEventListener('click', () => this.switchTab('stats'));
    this.tierTab.addEventListener('click', () => this.switchTab('tier'));
    this.energyTab.addEventListener('click', () => this.switchTab('energy'));
    this.fragmentsTab.addEventListener('click', () => this.switchTab('fragments'));
    this.achievementsTab.addEventListener('click', () => this.switchTab('achievements'));
    this.tokensTab.addEventListener('click', () => this.switchTab('tokens'));
    this.indexTab.addEventListener('click', () => this.switchTab('index'));
    this.optionsTab.addEventListener('click', () => this.switchTab('options'));
    this.tierUpBtn.addEventListener('click', () => this.tierUp());

    if (this.claimRewardBtn) {
        this.claimRewardBtn.addEventListener('click', () => this.claimDailyReward());
    }
    this.exportBtn.addEventListener('click', () => this.exportSave());
    this.importBtn.addEventListener('click', () => this.importSave());
    this.hardResetBtn.addEventListener('click', () => this.hardReset());
    if (this.creditsBtn) {
        this.creditsBtn.addEventListener('click', () => this.switchTab('credits'));
    }
    if (this.backBtn) {
        this.backBtn.addEventListener('click', () => this.switchTab('options'));
    }
    if (this.notationSelect) {
        this.notationSelect.value = window.options.notation;
        this.notationSelect.addEventListener('change', (e) => {
            window.options.notation = e.target.value;
            this.updateDisplay();
        });
    }
    if (this.musicSelect) {
        this.musicSelect.addEventListener('change', (e) => {
            this.backgroundMusic = e.target.value;
            this.changeBackgroundMusic();
            this.saveToStorage();
        });
    }
    document.querySelectorAll('.index-item').forEach(item => {
        item.addEventListener('click', (e) => this.selectIndexItem(e.target));
    });

    // Load save
    this.loadSave();
    
    // Update Shims
    window.player = this; 
    
    this.updateBonuses();
    this.selectIndexItem(document.querySelector('.index-item[data-stat="cash"]'));
    this.startGameLoop();
    this.updateDisplay();
    
    this.changeBackgroundMusic();
  }
  
  changeBackgroundMusic() {
    if (this.musicRetryTimeout) {
      clearTimeout(this.musicRetryTimeout);
      this.musicRetryTimeout = null;
    }
    
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio = null;
    }
    
    const musicFiles = {
      'none': null,
      'timeleaper': 'Time-Leaper.mp3',
      'realm': 'Realms.mp3',
      'explorer': 'Explorers.mp3',
      'outbreak': 'Outbreaker.mp3',
      'floating': 'FloatingCities.mp3',
      'cipher': 'Cipher.mp3',
      'omega': 'Omega.mp3',
      'heavenhell': 'HeavenHell.mp3',
      'signal': 'signaltonoise.mp3'
    };
    
    const musicFile = musicFiles[this.backgroundMusic];
    
    if (musicFile && this.backgroundMusic !== 'none') {
      this.backgroundAudio = new Audio(musicFile);
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.5;
      
      this.backgroundAudio.play().catch(e => {
        console.log('Music autoplay prevented, will retry in 10 seconds');
        this.musicRetryTimeout = setTimeout(() => {
          if (this.backgroundAudio && this.backgroundMusic !== 'none') {
            this.backgroundAudio.play().catch(err => {
              console.log('Music retry failed, will retry again in 10 seconds');
              this.musicRetryTimeout = setTimeout(() => {
                this.changeBackgroundMusic();
              }, 10000);
            });
          }
        }, 10000);
      });
    }
    
    if (this.musicSelect) {
      this.musicSelect.value = this.backgroundMusic;
    }
  }
  
  switchTab(tab) {
    // Deactivate all tabs and content panels
    for (const t of TABS) {
      document.getElementById(t + 'Tab')?.classList.remove('active');
      document.getElementById(t + 'Content')?.classList.remove('active');
    }
    document.getElementById('creditsContent')?.classList.remove('active');

    // Activate the selected tab and content
    document.getElementById(tab + 'Tab')?.classList.add('active');
    document.getElementById(tab + 'Content')?.classList.add('active');

    // Special cases
    if (tab === 'fragments' && this.fragmentCanvas) {
      this.initFragmentInteraction();
    }
    if (tab === 'index') {
      const runeTab = document.getElementById('runeIndexTab');
      if (runeTab && runeTab.classList.contains('active')) {
        this.switchIndexPage('runes');
      } else {
        this.switchIndexPage('stats');
      }
    }
  }

  switchIndexPage(page) {
    if (!this.statIndexPageBtn || !this.runeIndexPageBtn || !this.indexMainView || !this.runeMainView) return;
    
    this.statIndexPageBtn.classList.remove('active');
    this.runeIndexPageBtn.classList.remove('active');
    this.indexMainView.style.display = 'none';
    this.runeMainView.style.display = 'none';
    
    if (page === 'stats') {
      this.statIndexPageBtn.classList.add('active');
      this.indexMainView.style.display = 'flex';
      const activeItem = document.querySelector('.index-item.active');
      if (activeItem) this.updateIndexDisplay(activeItem.dataset.stat);
    } else if (page === 'runes') {
      if (this.tier >= 7) {
        this.runeIndexPageBtn.classList.add('active');
        this.runeMainView.style.display = 'flex';
        this.updateRuneInfoDisplay();
      } else {
        this.runeIndexPageBtn.classList.remove('active');
        this.runeMainView.style.display = 'none';
        this.statIndexPageBtn.classList.add('active');
        this.indexMainView.style.display = 'flex';
        const activeItem = document.querySelector('.index-item.active');
        if (activeItem) this.updateIndexDisplay(activeItem.dataset.stat);
      }
    }
  }

  updateRuneInfoDisplay() {
    if (!this.runeMainView) return;
    const listEl = document.getElementById('runeInfoList');
    
    if (listEl) {
        let html = '';
        this.runeSystem.runeData.forEach((rune, i) => {
            const info = this.runeInfoData[i];
            const count = this.runes[rune.id] || 0;
            html += `
                <div class="achievement-card" style="text-align: left; padding: 15px; cursor: default; gap: 4px;">
                    <div style="font-size: 1.3em; font-weight: bold; color: #2dd4bf;">${rune.name} Rune</div>
                    <div style="color: #94a3b8; font-size: 0.9em;">Effect: ${rune.desc + rune.boost}</div>
                    <div style="color: #facc15; font-size: 0.85em;">${info.softcap}</div>
                    <div style="margin-top: 8px; font-weight: bold; color: white;">Owned: ${count}</div>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }
  }

  updateRuneEff() {
    // F01 (Mini): +0.04/rune, softcap ^0.5 at 1, boosts Cash & Multiplier
    this.runeeff.F01 = softcap(this.runes.F01 * 0.04, 1, 0.5) + 1;

    // F02 (Small): +0.02/rune, softcap ^0.7 at 1, offset ^0.6 at 5, boosts Fragments
    let f02 = softcap(this.runes.F02 * 0.02, 1, 0.7);
    this.runeeff.F02 = offsetSoftcap(f02, 5, 0.6);

    // F03 (Medium): +0.04/rune, softcap ^0.4 at 1, boosts Rebirth
    this.runeeff.F03 = softcap(this.runes.F03 * 0.04, 1, 0.4) + 1;

    // F04 (Large): +0.1/rune, offset ^0.5 at 5, boosts Fragments
    this.runeeff.F04 = offsetSoftcap(this.runes.F04 * 0.1, 5, 0.5);

    // F05 (Extreme): +0.05/rune, softcap ^0.4 at 1, boosts Ultra & Energy
    this.runeeff.F05 = softcap(this.runes.F05 * 0.05, 1, 0.4) + 1;

    // F06 (Huge): +0.03/rune, softcap ^0.4 at 1, boosts Super
    this.runeeff.F06 = softcap(this.runes.F06 * 0.03, 1, 0.4) + 1;

    // F07 (Gigantic): +0.5/rune, offset ^0.6 at 50, boosts Fragments
    this.runeeff.F07 = offsetSoftcap(this.runes.F07 * 0.5, 50, 0.6);

    // F08 (Secret): +0.025/rune, two custom softcaps, boosts All Stats
    let f08 = this.runes.F08 * 0.025;
    if (f08 > 0.2) f08 = ((f08 + 0.8) ** 0.5) - 0.8;
    if (f08 > 0.5) f08 = ((f08 + 0.5) ** 0.5) - 0.5;
    this.runeeff.F08 = f08 + 1;
  }

  // Helper: get the combined rune multiplier for a set of rune IDs
  getRuneBoost(...runeIds) {
    return runeIds.reduce((product, id) => product * this.runeeff[id], 1);
  }

  getRebirthCost() {
    let cost = new Decimal(0);
    if (this.tier >= 1) {
      let term1 = new Decimal(1.3).add(this.rebirthCount.mul(0.2)).add(this.ultra.mul(0.4));
      cost = new Decimal(10).mul(term1.mul(this.rebirthCount).add(1));
    } else {
      cost = new Decimal(75).mul(this.rebirthCount.add(1));
    }
    if (this.energyUpgrades[4]) cost = cost.mul(0.7);
    return cost.mul(Decimal.pow(1.1, this.super)).floor();
  }
    
  getUltraCost() {
    let cost = new Decimal(10).mul(this.ultra.add(1).pow(1.25));
    if (this.energyUpgrades[5]) cost = cost.mul(0.875);
    if (this.energyUpgrades[7]) cost = cost.mul(0.9);
    // Tier 6+ Ultra Cost Nerf (3x)
    const tierNerf = this.tier >= 6 ? 3 : 1;
    return cost.mul(Decimal.pow(1.1, this.super)).mul(tierNerf).floor();
  }

  getRebirthCashBonus() {
    return new Decimal(1).add(this.rebirthCount.mul(0.1));
  }
  
  updateBonuses() {
    this.multiplierMult = new Decimal(1.5).pow(this.tier);
    this.cashBonus = new Decimal(1.5).pow(this.tier);
    this.rebirthMult = new Decimal(1);
    this.ultraMult = new Decimal(1);

    if (this.tier >= 1) {
      this.rebirthMult = new Decimal(1.2).pow(this.tier - 1);
    }
    if (this.tier >= 3) {
      this.ultraMult = new Decimal(1.2).pow(this.tier - 3);
    }
    if (this.tier >= 4) {
        this.multiplierMult = this.multiplierMult.mul(2);
        this.rebirthMult = this.rebirthMult.mul(2);
    }
    if (this.tier >= 5) {
        this.cashBonus = this.cashBonus.mul(2);
    }
    this.fragmentMult = new Decimal(1);
    if (this.tier >= 6) {
        this.fragmentMult = new Decimal(1.3).pow(this.tier - 5);
    }
    this.energyMult = this.tier >= 3 ? new Decimal(1.5).pow(this.tier - 3) : new Decimal(1);
  }
  
  getEnergyProduction() {
    if (this.tier < 3) return new Decimal(0); 
    let logCash = this.cash.add(1).log10().add(1);
    let logUltra = this.ultra.add(1).log2().add(1);
    let baseProd = logCash.mul(logUltra);
    if (this.energyUpgrades[0]) baseProd = baseProd.mul(1.5);
    if (this.energyUpgrades[3]) baseProd = baseProd.mul(2.5);
    if (this.energyUpgrades[6]) baseProd = baseProd.mul(1.75);
    if (this.fragmentUpgradesPurchased[0] > 0) {
        baseProd = baseProd.mul(new Decimal(1.1).pow(this.fragmentUpgradesPurchased[0]));
    }
    baseProd = baseProd.mul(this.getRuneBoost('F05', 'F08'))
    baseProd = baseProd.mul(new Decimal(1).add(this.super.mul(0.2)));
    const achBonuses = this.getAchievementBonuses();
    baseProd = baseProd.mul(achBonuses.energyBonus);
    return baseProd.mul(this.energyMult).mul(this.getTokenUpgradeBonus(5));
  }
  
  initFragmentInteraction() {
      const resize = () => {
          const container = this.fragmentCanvas.parentElement;
          this.fragmentCanvas.width = container.clientWidth;
          this.fragmentCanvas.height = container.clientHeight;
      };
      window.addEventListener('resize', resize);
      setTimeout(resize, 100); 
      
      this.fragmentCanvas.addEventListener('mousemove', (e) => {
          const rect = this.fragmentCanvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          
          for (let i = this.shards.length - 1; i >= 0; i--) {
              const s = this.shards[i];
              const dist = Math.sqrt((mx - s.x) ** 2 + (my - s.y) ** 2);
              if (dist < 40) {
                  this.collectShard(i);
              }
          }
      });
  }

  updateFragments(dt) {
      if (!this.fragmentCanvas) return;
      if (game.fragmentsTab.classList.contains("active")) {
        this.fragmentSpawnTimer += dt
      };
      if (this.fragmentSpawnTimer > 2.5) { 
          if (this.shards.length < 50) { 
              const x = Math.random() * this.fragmentCanvas.width;
              const y = Math.random() * this.fragmentCanvas.height;
              if (typeof Shard !== 'undefined') {
                  const newShard = new Shard(x, y);
                  // Bigger and Better Upgrade: +0.5s duration per level
                  if (this.fragmentUpgradesPurchased[1] > 0) {
                      newShard.maxAge += Math.min(this.fragmentUpgradesPurchased[1] * 0.4, 5);
                  }
                  this.shards.push(newShard);
              }
          }
          this.fragmentSpawnTimer = 0;
      }
      
      for (let i = this.shards.length - 1; i >= 0; i--) {
          const dead = this.shards[i].update(dt);
          if (dead) {
              this.shards.splice(i, 1);
          }
      }
  }
  
  renderFragments() {
      if (!this.ctx || !this.fragmentCanvas) return;
      
      // Clear
      this.ctx.clearRect(0, 0, this.fragmentCanvas.width, this.fragmentCanvas.height);
      
      // Render
      for (let s of this.shards) {
          s.render(this.ctx);
      }
  }
  
  collectShard(index) {
      const shard = this.shards[index];
      const collectSound = new Audio('shardCollect.wav');
      if (shard) {
          let val = shard.value || new Decimal(1);
          if (this.fragmentMult) {
              val = val.mul(this.fragmentMult);
          }
          if (this.fragmentUpgradesPurchased[1] > 0) {
              val = val.mul(Decimal.pow(1.5, this.fragmentUpgradesPurchased[1]));
          }
          if (this.fragmentUpgradesPurchased[2] > 0) {
              val = val.mul(Decimal.pow(3, this.fragmentUpgradesPurchased[2]));
          }
          val = val.mul(this.getTokenUpgradeBonus(6));
          val = val.mul(this.fragmentBonus)
          const fragmentRuneBoost = (this.runeeff.F02 + this.runeeff.F04 + this.runeeff.F07 + 1) * this.runeeff.F08;
          val = val.mul(fragmentRuneBoost)
          this.fragments = this.fragments.add(val);
          this.shards.splice(index, 1);
          collectSound.play();
      }
  }

  // Daily Reward System
  claimDailyReward() {
    const now = Date.now();
    const waitTime = 24 * 60 * 60 * 1000; // 24 hours
    const streakTimeout = 48 * 60 * 60 * 1000; // 48 hours to preserve streak

    if (now - this.lastDailyRewardTime >= waitTime) {
      // Check if streak is maintained
      if (this.lastDailyRewardTime === 0 || now - this.lastDailyRewardTime <= streakTimeout) {
        this.currentStreak++;
      } else {
        this.currentStreak = 1;
      }

      if (this.currentStreak > this.highestStreak) {
        this.highestStreak = this.currentStreak;
      }

      const reward = 5 + 5 * this.currentStreak;
      this.tokens += reward;
      this.lastDailyRewardTime = now;

      this.saveToStorage();
      this.updateDisplay();
      alert(`Claimed ${reward} tokens! Your streak is now ${this.currentStreak} days.`);
    }
  }

  // Fragment Upgrades
  getFragmentUpgradeCost(index = 0) {
      if (index === 0) {
        return new Decimal(75).mul(new Decimal(1.25).add(this.fragmentUpgradesPurchased[0]/50).pow(this.fragmentUpgradesPurchased[0]));
      } else if (index === 1) {
        return new Decimal(200).mul(Decimal.pow(Math.max((1.325 + this.fragmentUpgradesPurchased[1]*0.075), 2), this.fragmentUpgradesPurchased[1])).floor();
      } else if (index === 2) {
        return new Decimal(25000).mul(Decimal.pow(200, this.fragmentUpgradesPurchased[2])).floor();
      }
      return new Decimal(Infinity);
  }

  buyFragmentUpgrade(index = 0) {
    const cost = this.getFragmentUpgradeCost(index);
    if (this.fragments.gte(cost)) {
      if (index === 0 && this.fragmentUpgradesPurchased[0] >= 25) return; // Cap for original
      if (index === 1 && this.fragmentUpgradesPurchased[1] >= 15) return; // Cap for "Bigger and Better"
      if (index === 2 && this.fragmentUpgradesPurchased[2] >= 2) return; // Cap for "Super Fragment"

      this.fragments = this.fragments.sub(cost);
      this.fragmentUpgradesPurchased[index]++;
      this.saveToStorage();
      this.updateDisplay();
    }
  }

  // Token Upgrades
  getTokenUpgradeCost(index) {
    const lvl = this.tokenUpgrades[index];
    if (lvl >= 100) return Infinity;

    switch (index) {
      case 0: // Cash
        return Math.floor((5 + 2 * lvl) * Math.pow(1.125, lvl));
      case 1: // Multi
        return Math.floor((8 + 2 * lvl) * Math.pow(1.135, lvl));
      case 2: // Rebirth
        return Math.floor(8 * Math.pow(1.16, lvl));
      case 3: // Ultra
        return Math.floor((10 + 0.5 * lvl) * Math.pow(1.19, lvl));
      case 4: // Super
        return Math.floor((12 + 1.8 * lvl) * Math.pow(1.2, lvl));
      case 5: // Energy
        return Math.floor((12 + 2 * lvl) * Math.pow(1.15, lvl));
      case 6: // Frags
        return Math.floor((15 + 5 * lvl) * Math.pow(1.18, lvl));
      case 7: // Hyper
        return Math.floor((10 + 1 * lvl) * Math.pow(1.1, lvl));
      default:
        return Infinity;
    }
  }

  getTokenUpgradeBonus(index) {
    const lvl = this.tokenUpgrades[index];
    switch (index) {
      case 0: // Cash
      case 1: // Multi
        return Decimal.pow(1.2, lvl);
      case 2: // Rebirth
      case 3: // Ultra
      case 4: // Super
      case 5: // Energy
      case 6: // Frags
        return Decimal.pow(1.1, lvl);
      case 7: // Hyper
        return Decimal.pow(1.05, lvl);
      default:
        return new Decimal(1);
    }
  }

  buyTokenUpgrade(index) {
    const cost = this.getTokenUpgradeCost(index);
    if (this.tokens >= cost && this.tokenUpgrades[index] < 100) {
      this.tokens -= cost;
      this.tokenUpgrades[index]++;
      this.saveToStorage();
      this.updateDisplay();
    }
  }

  // Get Energy Boosts
  getEnergyBoosts() {
    let cashBoost = new Decimal(1);
    let multBoost = new Decimal(1);
    let rebirthBoost = new Decimal(1);
    let scCash = 1.1; let scMult = 1.07; let scReb = 1.05;
    if (this.tier >= 5) scCash = 1.15;
    if (this.tier >= 6) scMult = 1.14;
    if (this.energy.gt(1)) {
        // 1.1 ^ log2(Energy)
        cashBoost = new Decimal(scCash).pow(this.energy.log2());
    }
    if (this.energy.gte(100)) {
        // 1.07 ^ log2(Energy/100)
        multBoost = new Decimal(scMult).pow(this.energy.div(100).log2());
    }
    if (this.energy.gte(10000)) {
        // 1.05 ^ log2(Energy/10000)
        rebirthBoost = new Decimal(scReb).pow(this.energy.div(10000).log2());
    }
    return { cashBoost, multBoost, rebirthBoost };
  }
  
  // Check and unlock achievements (definitions are in ACHIEVEMENT_DEFS constant)
  checkAchievements() {
    for (const { key, check } of ACHIEVEMENT_DEFS) {
      if (!this.achievements[key] && check(this)) {
        this.achievements[key] = true;
      }
    }
  }
  
  // Get achievement bonuses (definitions are in ACHIEVEMENT_BONUSES constant)
  getAchievementBonuses() {
    const bonuses = {
      cashBonus: new Decimal(1), multGainBonus: new Decimal(1),
      rebirthGainBonus: new Decimal(1), ultraGainBonus: new Decimal(1),
      energyBonus: new Decimal(1), fragmentBonus: new Decimal(1),
      superBonus: new Decimal(1),
    };
    for (const { key, effects } of ACHIEVEMENT_BONUSES) {
      if (this.achievements[key]) {
        for (const [stat, mult] of Object.entries(effects)) {
          bonuses[stat] = bonuses[stat].mul(mult);
        }
      }
    }
    return bonuses;
  }

  getIncomeRate() {
    const baseRate = this.baseIncome.mul(20); 
    const boosts = this.getEnergyBoosts();
    const achBonuses = this.getAchievementBonuses();
    let effectiveMultiplier = this.multiplier.add(1).mul(boosts.multBoost);
    const withMultiplier = baseRate.mul(effectiveMultiplier);
    let ultraBoost = this.ultra.mul(1.5).add(1);
    let withRebirthnUltra = withMultiplier.mul(this.getRebirthCashBonus()).mul(this.cashBonus).mul(ultraBoost);
    if (this.energyUpgrades[2]) withRebirthnUltra = withRebirthnUltra.mul(1.25);
    return withRebirthnUltra.mul(boosts.cashBoost).mul(achBonuses.cashBonus).mul(this.getTokenUpgradeBonus(0)).mul(this.getRuneBoost('F01', 'F08'));
  }
  
  // Load save from localStorage

  applySaveData(data) {
    const ENERGY_UPGRADE_COUNT = 12;
    const FRAGMENT_UPGRADE_COUNT = 8;
    const TOKEN_UPGRADE_COUNT = 8;
    this.cash = new Decimal(data.cash || 0);
    this.multiplier = new Decimal(data.multiplier || 0);
    this.rebirthCount = new Decimal(data.rebirthCount || 0);
    this.ultra = new Decimal(data.ultra || 0);
    this.super = new Decimal(data.super || 0);
    this.hyper = new Decimal(data.hyper || 0);
    this.energy = new Decimal(data.energy || 0);
    this.timeToken = new Decimal(data.timeToken ?? 300);
    this.ttlcash = new Decimal(data.ttlcash || 0);
    this.totalRunesOpened = new Decimal(data.totalRunesOpened || 0);
  
    this.runeSpeed = data.runeSpeed ?? 1;
    this.runeLuck  = data.runeLuck  ?? 1;
    this.runeBulk  = data.runeBulk  ?? 1;
  
    this.runes = data.runes ?? {
      F01:0,F02:0,F03:0,F04:0,F05:0,F06:0,F07:0,F08:0
    };
    this.runeeff = data.runeeff ?? {
      F01:1,F02:0,F03:1,F04:0,F05:1,F06:1,F07:0,F08:1
    };
    this.energyUpgrades = Array.isArray(data.energyUpgrades)
      ? data.energyUpgrades.slice()
      : [];
    this.fragments = new Decimal(data.fragments || 0);
    this.fragmentUpgradesPurchased = Array.isArray(data.fragmentUpgradesPurchased)
      ? data.fragmentUpgradesPurchased.slice()
      : [];
    this.tokenUpgrades = Array.isArray(data.tokenUpgrades)
      ? data.tokenUpgrades.slice()
      : [];
    this.tokens = data.tokens || 0;
  
    // ---------- Migration / sanitisation ----------
    while (this.energyUpgrades.length < ENERGY_UPGRADE_COUNT)
      this.energyUpgrades.push(false);
  
    while (this.fragmentUpgradesPurchased.length < FRAGMENT_UPGRADE_COUNT)
      this.fragmentUpgradesPurchased.push(0);
  
    while (this.tokenUpgrades.length < TOKEN_UPGRADE_COUNT)
      this.tokenUpgrades.push(0);
  
    this.energyUpgrades = this.energyUpgrades.map(v => v ?? false);
    this.fragmentUpgradesPurchased = this.fragmentUpgradesPurchased.map(v => v ?? 0);
    this.tokenUpgrades = this.tokenUpgrades.map(v => v ?? 0);

    this.lastDailyRewardTime = data.lastDailyRewardTime || 0;
    this.currentStreak = data.currentStreak || 0;
    this.highestStreak = data.highestStreak || 0;
    this.achievements = data.achievements ?? {
      goodStart:false,
      firstRebirth:false,
      rebirthEngine:false,
      kilowatt:false,
      upgradedProduction:false,
      ultraMomentum:false,
      supercharged:false,
      kilofrag:false,
      superfragment:false
    };
    this.playTime = data.playTime || 0;
    this.tier = data.tier || 0;
    this.backgroundMusic = data.backgroundMusic || 'signal';
    this.updateBonuses();
    if ((((this.lastDailyRewardTime + (24 * 60 * 60 * 1000)) - Date.now())/1000) > 86400) this.lastDailyRewardTime = Date.now() // Such that if Next Reward duration >23:59:59, set it to 23:59:59
  }
  
  loadSave() {
    const encoded = localStorage.getItem('statGrindingSave');
    if (!encoded) return;
    try {
      const data = JSON.parse(atob(encoded));
      this.applySaveData(data);
      this.changeBackgroundMusic();
    } catch (e) {
      console.error('Failed to load save', e);
    }
  }

  importSave() {
    try {
      const data = JSON.parse(atob(this.importText.value));
      this.applySaveData(data);
      this.changeBackgroundMusic();
      this.saveToStorage();
      this.updateDisplay();
      alert('Save imported successfully.');
    } catch {
      alert('Invalid save data');
    }
  }
  
  getSaveData() {
    return {
      cash: this.cash,
      multiplier: this.multiplier,
      rebirthCount: this.rebirthCount,
      ultra: this.ultra,
      super: this.super,
      hyper: this.hyper,
      energy: this.energy,
      runes: this.runes,
      runeeff: this.runeeff,
      runeSpeed: this.runeSpeed,
      runeBulk: this.runeBulk,
      runeLuck: this.runeLuck,
      ttlcash: this.ttlcash,
      timeToken: this.timeToken,
      energyUpgrades: this.energyUpgrades,
      fragments: this.fragments,
      fragmentUpgradesPurchased: this.fragmentUpgradesPurchased,
      tokens: this.tokens,
      totalRunesOpened: this.totalRunesOpened,
      lastDailyRewardTime: this.lastDailyRewardTime,
      currentStreak: this.currentStreak,
      highestStreak: this.highestStreak,
      tokenUpgrades: this.tokenUpgrades,
      achievements: this.achievements,
      playTime: this.playTime,
      tier: this.tier,
      backgroundMusic: this.backgroundMusic
    };
  }
  
  saveToStorage() {
    const encoded = btoa(JSON.stringify(this.getSaveData()));
    localStorage.setItem('statGrindingSave', encoded);
  }
  
  exportSave() {
    const encoded = btoa(JSON.stringify(this.getSaveData()));
    this.importText.value = encoded;
    alert('Save data copied to import box. Copy it from there.');
  }
  
  // Hard reset
  hardReset() {
    if (confirm('Are you sure you want to hard reset? This will delete all progress and cannot be undone.')) {
      // Reset all currencies to zero
      this.cash = new Decimal(0);
      this.multiplier = new Decimal(0);
      this.rebirthCount = new Decimal(0);
      this.ultra = new Decimal(0);
      this.super = new Decimal(0);
      this.hyper = new Decimal(0);
      this.energy = new Decimal(0);
      this.fragments = new Decimal(0);
      this.ttlcash = new Decimal(0);
      this.totalRunesOpened = new Decimal(0);
      this.timeToken = new Decimal(300);

      // Reset progression
      this.tier = 0;
      this.playTime = 0;
      this.tokens = 0;
      this.runeSpeed = 1;
      this.runeLuck = 1;
      this.runeBulk = 1;
      this.lastDailyRewardTime = 0;
      this.currentStreak = 0;
      this.highestStreak = 0;

      // Reset upgrades and collections using shared defaults
      this.runes = { ...DEFAULT_RUNES };
      this.runeeff = { ...DEFAULT_RUNE_EFF };
      this.achievements = { ...DEFAULT_ACHIEVEMENTS };
      this.energyUpgrades = new Array(12).fill(false);
      this.fragmentUpgradesPurchased = new Array(8).fill(0);
      this.tokenUpgrades = new Array(8).fill(0);

      this.updateBonuses();
      localStorage.removeItem('statGrindingSave');
      this.updateDisplay();
      alert('Game has been hard reset.');
    }
  }

  // Buy Energy Upgrade
  buyEnergyUpgrade(index) {
      if (this.energyUpgrades[index]) return;
      
      const costs = [4000, 10000, 25000, 50000, 150000, 400000, 750000, 2500000];
      const cost = new Decimal(costs[index]);
      
      if (this.energy.gte(cost)) {
          this.energy = this.energy.sub(cost);
          this.energyUpgrades[index] = true;
          this.saveToStorage();
          this.updateDisplay();
      }
  }
  
  // Calculate Multiplier Cost
  calculateMultiplierCost() {
      let cost = new Decimal(100).add(this.multiplier.mul(50)).mul(new Decimal(1).add(this.rebirthCount.div(10)));
      if (this.tier >= 6) {
          cost = cost.mul(2);
      }
      if (this.tier > 3) {
        const scalingBase = this.tier >= 7 ? 1.04 : 1.15;
        cost = cost.mul(new Decimal(scalingBase).pow(this.ultra));
      }
      return cost.mul(Decimal.pow(1.1, this.super));
  }

  // Buy multiplier
  buyMultiplier() {
    const cost = this.calculateMultiplierCost();
    if (this.cash.gte(cost)) {
      this.cash = this.cash.sub(cost);
      const achBonuses = this.getAchievementBonuses();
      let multgain = this.multiplierMult.mul(this.rebirthCount.add(1)).mul(achBonuses.multGainBonus);
      if (this.tier >= 6) {
          multgain = multgain.mul(2);
      }
      multgain = multgain.mul(this.getTokenUpgradeBonus(1)).mul(this.getRuneBoost('F01', 'F08'));
      multgain = multgain.mul(new Decimal(1).add(this.hyper.mul(2)))
      this.multiplier = this.multiplier.add(multgain);
      this.saveToStorage();
    }
  }
  
  // Tier up
  tierUp() {
    if (this.canAffordTier()) {
      this.tier++;
      this.cash = new Decimal(0);
      this.multiplier = new Decimal(0);
      this.rebirthCount = new Decimal(0);
      this.ultra = new Decimal(0);
      this.super = new Decimal(0);
      this.hyper = new Decimal(0);
      this.fragments = new Decimal(0);
      this.energy = new Decimal(0);
      this.energyUpgrades = this.energyUpgrades.map(() => false);
      for (let i = 0; i < this.fragmentUpgradesPurchased.length; i++) {
        this.fragmentUpgradesPurchased[i] = Math.max(0, this.fragmentUpgradesPurchased[i] - 1);
      }
      for (const key in this.runes) {
        this.runes[key] = Math.max(0, this.runes[key] / 2);
      }
      this.runeSpeed = 1;
      this.runeBulk = 1;
      this.runeLuck = 1;
      this.shards = [];
      this.energyTimer = 0;
      this.fragmentSpawnTimer = 0;

      this.updateBonuses();
      this.saveToStorage();
      this.updateDisplay();
      this.updateRuneEff();
    }
  }
  
  canAffordTier() {
    if (this.multiplier.gte(10) && this.tier === 0) return true;
    if (this.rebirthCount.gte(3) && this.tier === 1) return true;
    if (this.rebirthCount.gte(20) && this.tier === 2) return true;
    if (this.ultra.gte(10) && this.tier === 3) return true;
    if (this.super.gte(2) && this.tier === 4) return true;
    if ((this.ultra.gte(70) || this.super.gte(5)) && this.tier === 5) return true;
    if (this.fragmentUpgradesPurchased[0]>=10 && this.fragmentUpgradesPurchased[1]>=6 && this.tier === 6) return true;
    if (this.fragments.gte(2e6) && this.tier === 7) return true;
    return false;
  }
  
  // Start the game loop
  startGameLoop() {
    setInterval(() => {
      const income = this.getIncomeRate().div(20); 
      this.cash = this.cash.add(income);
      this.ttlcash = this.ttlcash.add(income);

      const dt = this.tickInterval / 1000;
      this.energyTimer += dt;
      if (this.energyTimer >= 15) {
          const energyProdPerSec = this.getEnergyProduction();
          const burstAmount = energyProdPerSec.mul(15);
          this.energy = this.energy.add(burstAmount);
          this.energyTimer = 0; 
      }
      if (this.tier >= 5) {
          this.updateFragments(dt);
          if (this.fragmentsTab.classList.contains('active')) {
             this.renderFragments();
          }
      }
      this.playTime += this.tickInterval / 1000;
      const multiplierCost = this.calculateMultiplierCost();
      if (this.cash.gte(multiplierCost)) {
        this.buyMultiplier();
      }
      if (this.multiplier.gte(this.getRebirthCost())) {
        this.performRebirth();
      }
      if (this.rebirthCount.gte(this.getUltraCost())) {
        this.performUltra();
      }
      if (this.ultra.gte(this.getSuperCost())) {
        this.performSuper();
      }
      if (this.super.gte(this.getHyperCost())) {
        this.performHyper();
      }
      // Handle Rune Hold
      if (this.isHoldingRune && this.fragments.gte(5000)) {
        this.runeHoldTime += this.tickInterval * this.runeSpeed;
        const progress = Math.min((this.runeHoldTime / this.runeHoldThreshold) * 100, 100);
        if (this.holdProgress) this.holdProgress.style.width = `${progress}%`;
        while (this.runeHoldTime >= this.runeHoldThreshold && this.fragments.gte(5000)) {
          this.runeSystem.openRune();
          this.runeHoldTime -= this.runeHoldThreshold;
        }
      } else if (this.runeHoldTime > 0) {
          this.runeHoldTime = 0;
          if (this.holdProgress) this.holdProgress.style.width = '0%';
      }

      if (this.playTime > this.timeToken) {
        this.timeToken = this.playTime + 300;
        this.tokens = this.tokens + 1;
      }

      this.updateDisplay();
    }, this.tickInterval);
  }
  
  performRebirth() {
    const cost = this.getRebirthCost();
    if (this.multiplier.gte(cost)) {
      this.multiplier = new Decimal(0);
      
      const boosts = this.getEnergyBoosts();
      const achBonuses = this.getAchievementBonuses();
      let gain = this.rebirthMult.mul(this.ultra.add(1));
      gain = gain.mul(boosts.rebirthBoost);
      
      gain = gain.mul(new Decimal(1).add(this.super));
      
      if (this.energyUpgrades[1]) gain = gain.mul(1.25);
      gain = gain.mul(achBonuses.rebirthGainBonus);
      gain = gain.mul(this.getTokenUpgradeBonus(2));
      gain = gain.mul(this.getRuneBoost('F03', 'F08'))
      this.rebirthCount = this.rebirthCount.add(gain);
      this.cash = new Decimal(0);
      this.saveToStorage();
    }
  } 

  performUltra() {
    const cost = this.getUltraCost();
    if (this.rebirthCount.gte(cost)) {
      this.multiplier = new Decimal(0);
      this.rebirthCount = new Decimal(0);
      this.cash = new Decimal(0);
      const achBonuses = this.getAchievementBonuses();
      let gain = this.ultraMult; 
      gain = gain.mul(this.getRuneBoost('F05', 'F08'))
      gain = gain.mul(new Decimal(1).add(this.super.mul(0.5)));
      gain = gain.mul(new Decimal(1).add(this.hyper.mul(2)))
      if (this.energyUpgrades[2]) gain = gain.mul(1.25);
      gain = gain.mul(achBonuses.ultraGainBonus);
      gain = gain.mul(this.getTokenUpgradeBonus(3));
      this.ultra = this.ultra.add(gain);
      this.saveToStorage();
    }
  }
  
  getSuperCost() {
    let cost =  new Decimal(20).mul(this.super.add(1).pow(1.2).mul(0.5).add(0.5)).floor();
    if (this.energyUpgrades[7]) cost = cost.mul(0.9);
    return cost
  }

  getHyperCost() {
    // Placeholder cost — player needs 25 Super to Hyper
    let cost = new Decimal(25).mul(this.hyper.add(1).pow((this.hyper.add(1)).log10().div(2).add(1)))
    return cost;
  }

  performSuper() {
      const cost = this.getSuperCost();
      if (this.ultra.gte(cost)) {
          this.ultra = new Decimal(0);
          this.rebirthCount = new Decimal(0);
          this.multiplier = new Decimal(0);
          this.cash = new Decimal(0);
          let gain = this.getTokenUpgradeBonus(4).mul(this.superBonus)
          gain = gain.mul(new Decimal(1).add(this.hyper.mul(2)))
          gain = gain.mul(this.getRuneBoost('F06', 'F08'))
          this.super = this.super.add(gain);
          
          if (Math.random() < 0.1) {
              this.energy = new Decimal(0);
              console.log('Unstability Triggered: Energy has been reset!');
          }
          
          this.saveToStorage();
          this.updateDisplay();
      }
  }

  performHyper() {
    const cost = this.getHyperCost();
    if (this.super.gte(cost)) {
      // Reset everything below Hyper
      this.super = new Decimal(0);
      this.ultra = new Decimal(0);
      this.rebirthCount = new Decimal(0);
      this.multiplier = new Decimal(0);
      this.cash = new Decimal(0);

      let gain = new Decimal(1).mul(this.getTokenUpgradeBonus(7)); // Base gain of 1 Hyper
      this.hyper = this.hyper.add(gain);

      this.saveToStorage();
      this.updateDisplay();
    }
  }

  // Update all displays
  updateDisplay() {
    try {
        this.checkAchievements();
        
        if (this.tier >= 3) {
            this.energyTab.style.display = 'inline-block';
        } else {
            this.energyTab.style.display = 'none';
        }
        const incomeRate = notationChooser(this.getIncomeRate(), 1);
        this.cashDisplay.innerHTML = `Cash: ${notationChooser(this.cash, 1)} <span style="color: #4ade80;">(+${incomeRate}/sec)</span>`;
        
        const nextBuyCost = this.calculateMultiplierCost();
        const multVal = notationChooser(this.multiplier.add(1), 1);
        const costVal = notationChooser(nextBuyCost, 1);
        this.multiplierDisplay.innerHTML = `Multiplier: ${multVal} <span style="color: #f87171;">(next buy at ${costVal})</span>`;
        
        const nextRebirthCost = this.getRebirthCost();
        this.rebirthDisplay.innerHTML = `Rebirth: ${notationChooser(this.rebirthCount, 0)} <span style="color: #60a5fa;">(next at ${notationChooser(nextRebirthCost, 1)} multiplier)</span>`;
        
        if (this.ultra.gt(0) || this.super.gt(0) || this.rebirthCount.gt(0)) {
          this.ultraDisplay.style.display = 'block';
          const nextUltraCost = this.getUltraCost();
          this.ultraDisplay.innerHTML = `Ultra: ${notationChooser(this.ultra, 0)} <span style="color: #bf00ff;">(next at ${notationChooser(nextUltraCost, 0)} Rebirths)</span>`;
        } else {
             this.ultraDisplay.style.display = 'none';
        }
        
        // Super Display
        if (this.ultra.gt(0) || this.super.gt(0)) {
            this.superDisplay.style.display = 'block';
            const nextSuperCost = this.getSuperCost();
            this.superDisplay.innerHTML = `Super: ${notationChooser(this.super, 0)} <span style="color: #15803d;">(next at ${notationChooser(nextSuperCost, 0)} Ultra)</span>`;
        } else {
             this.superDisplay.style.display = 'none';
        }

        // Hyper Display
        if (this.super.gt(0) || this.hyper.gt(0)) {
            this.hyperDisplay.style.display = 'block';
            const nextHyperCost = this.getHyperCost();
            this.hyperDisplay.innerHTML = `<span style="color: #383737ff;"> Hyper: ${notationChooser(this.hyper, 0)} (next at ${notationChooser(nextHyperCost, 0)} Super)</span>`;
        } else {
            this.hyperDisplay.style.display = 'none';
        }
        
        // Token Buttons unlock
        let tier = 0
        if (this.rebirthCount.gt(0)) tier = 2
        if (this.ultra.gt(0)) tier = 3
        if (this.super.gt(0)) tier = 4
        if (this.hyper.gt(0)) tier = 5
        if (tier >= 2) {
          document.getElementById('tUpg3').style.display = 'block';
        } else {
          document.getElementById('tUpg3').style.display = 'none';
        }
        if (tier >= 3) {
          document.getElementById('tUpg4').style.display = 'block';
        } else {
          document.getElementById('tUpg4').style.display = 'none';
        }
        if (tier >= 4) {
          document.getElementById('tUpg7').style.display = 'block';
        } else {
          document.getElementById('tUpg7').style.display = 'none';
        }
        if (this.tier >= 3) {
          document.getElementById('tUpg5').style.display = 'block';
        } else {
          document.getElementById('tUpg5').style.display = 'none';
        }
        if (this.tier >= 5) {
          document.getElementById('tUpg6').style.display = 'block';
        } else {
          document.getElementById('tUpg6').style.display = 'none';
        }

        if (this.rebirthCount)
        // Energy Display
        if (this.tier >= 3) {
            const energyProd = this.getEnergyProduction();
            this.energyDisplay.innerText = notationChooser(this.energy, 2);
            this.energyPerSec.innerText = notationChooser(Decimal.floor(energyProd * 15), 2);
            
            // Update Progress Bar
            const percent = Math.min((this.energyTimer / 15) * 100, 100);
            if (this.energyProgressBar) this.energyProgressBar.style.width = `${percent}%`;
            if (this.energyTimerText) this.energyTimerText.innerText = `${this.energyTimer.toFixed(1)}s / 15.0s`;
            
            const boosts = this.getEnergyBoosts();
            this.energyCashBoost.innerText = `x${notationChooser(boosts.cashBoost, 2)} Cash Multiplier`;
            this.energyMultBoost.innerText = `x${notationChooser(boosts.multBoost, 2)} Multiplier Multiplier`;
            this.energyRebirthBoost.innerText = `x${notationChooser(boosts.rebirthBoost, 2)} Rebirth Multiplier`;

            if (this.eUpBtns && this.eUpBtns.length > 0) {
                this.eUpBtns.forEach((btn, i) => {
                    if (!btn) return;
                    // Hide upgrades the player hasn't unlocked yet
                    if (this.tier < ENERGY_UPGRADE_TIER_REQ[i]) {
                        btn.style.display = 'none';
                        return;
                    }
                    btn.style.display = 'block';

                    if (this.energyUpgrades[i]) {
                        btn.classList.add('bought');
                        btn.disabled = true;
                        const costEl = btn.querySelector('.upg-cost');
                        if (costEl) costEl.innerText = "Purchased";
                    } else {
                        btn.classList.remove('bought');
                        btn.disabled = this.energy.lt(ENERGY_UPGRADE_COSTS[i]);
                        const costEl = btn.querySelector('.upg-cost');
                        if (costEl) costEl.innerText = `Cost: ${ENERGY_UPGRADE_LABELS[i]} Energy`;
                    }
                });
            }
        }
        
        if (this.tier >= 5) {
            this.fragmentsTab.style.display = 'block';
            if (this.fragmentDisplay) {
                this.fragmentDisplay.innerText = notationChooser(this.fragments, 2);
            }
            if (this.runesContainer) {
                this.runesContainer.style.display = this.tier >= 7 ? 'flex' : 'none';
            }

                // Render Rune List
                if (this.tier >= 7 && this.runeList) {
                    let runeHtml = '';
                    this.runeSystem.runeData.forEach(rune => {
                        const count = this.runes[rune.id] || 0;
                        const oneInX = 100 / rune.chance;
                        let rarity = 'Common';
                        let rarityClass = '';
                        if (oneInX > 10000) {
                            rarity = 'Secret';
                        } else if (oneInX > 2000) {
                            rarity = 'Mythical';
                        } else if (oneInX > 400) {
                            rarity = 'Legendary';
                        } else if (oneInX > 100) {
                            rarity = 'Epic';
                        } else if (oneInX > 20) {
                            rarity = 'Rare';
                        } else if (oneInX > 4) {
                            rarity = 'Uncommon';
                        } else {
                            rarity = 'Common';
                        }
                        rarityClass = " " + rarity.toLowerCase();
                        let effectHtml = rune.desc + rune.boost;
                        effectHtml = effectHtml.replace(/Cash/g, '<span class="effect-cash" style="color: #22c55e;">Cash</span>');
                        effectHtml = effectHtml.replace(/Multiplier/g, '<span class="effect-multiplier" style="color: #ef4444;">Multiplier</span>');
                        effectHtml = effectHtml.replace(/Fragments/g, '<span class="effect-fragments" style="color: #a855f7;">Fragments</span>');
                        effectHtml = effectHtml.replace(/Rebirth/g, '<span class="effect-rebirth" style="color: #3b82f6;">Rebirth</span>');
                        effectHtml = effectHtml.replace(/Ultra/g, '<span class="effect-ultra" style="color: #bf00ff;">Ultra</span>');
                        effectHtml = effectHtml.replace(/Energy/g, '<span class="effect-energy" style="color: #facc15;">Energy</span>');
                        effectHtml = effectHtml.replace(/Super/g, '<span class="effect-super" style="color: #15803d;">Super</span>');
                        effectHtml = effectHtml.replace(/All Stats/g, '<span class="effect-all-stats">All Stats</span>');
                        
                        runeHtml += `
                          <div class="rune-item${rarityClass}">
                            <div class="rune-item-header">
                              <div style="display: flex; align-items: center;">
                                <span class="rune-rarity">${rarity}</span>
                                <span class="rune-name">${rune.name} <span style="font-size: 0.85em;">Rune</span></span>
                              </div>
                              <span class="rune-chance">${rune.chance}%</span>
                            </div>
                            <div class="rune-item-bottom">
                              <span class="rune-owned">Owned: ${count}</span>
                              <span class="rune-effect">${effectHtml}</span>
                            </div>
                          </div>
                        `;
                    });
                    this.runeList.innerHTML = runeHtml;
                }
            
            // Fragment Upgrade Buttons — use a helper to avoid repeating the same pattern
            this.updateFragUpgradeBtn(
              this.fragmentUpgradeBtn, 0, 'Energy Boost', 25,
              'x1.1 Energy Production',
              (p) => `Currently: x${notationChooser(new Decimal(1.1).pow(p), 2)}`,
              0  // always visible at tier 5+
            );
            this.updateFragUpgradeBtn(
              document.getElementById('fragmentUpgradeBtn2'), 1, 'Bigger and Better', 15,
              '+0.4s duration, x1.5 Fragments',
              (p) => `Currently: +${Math.min(p * 0.4, 5)}s duration, x${notationChooser(Decimal.pow(1.5, p), 2)} Fragments`,
              6,  // visible at tier 6+
              'fragmentUpgrade2Total'
            );
            this.updateFragUpgradeBtn(
              document.getElementById('fragmentUpgradeBtn3'), 2, 'Super Fragment', 2,
              'Gain an OP boost of x3 Fragments',
              (p) => `Currently: x${notationChooser(Decimal.pow(3, p), 2)}`,
              7,  // visible at tier 7+
              'fragmentUpgrade3Total'
            );
            
        } else {
            this.fragmentsTab.style.display = 'none';
        }

        // Tokens Display Logic
        if (this.currentStreakDisplay) {
            this.tokenDisplay.innerText = this.tokens;
            this.tokenTimer.innerText = formatTime(this.timeToken - this.playTime);
            this.currentStreakDisplay.innerText = this.currentStreak;
            this.highestStreakDisplay.innerText = this.highestStreak;
            let dtime = Date.now() - this.lastDailyRewardTime;
            const waitTime = 24 * 60 * 60 * 1000;
            const timeDiff = dtime;

            const streakTimeout = 48 * 60 * 60 * 1000;
            if (this.lastDailyRewardTime !== 0 && dtime > streakTimeout) {
                this.currentStreak = 0;
            }

            let possibleStreak = this.currentStreak + 1;
            if (this.lastDailyRewardTime !== 0 && dtime > streakTimeout) {
                possibleStreak = 1;
            }
            this.nextRewardAmount.innerText = 5 + 5 * possibleStreak;
            if (timeDiff >= waitTime) {
                this.rewardTimer.innerText = 5 + 5 * possibleStreak + " Tokens";
                this.rewardTimerLabel.innerText = "Your reward is ready:";
                this.claimRewardBtn.disabled = false;
                this.claimLockedMsg.style.display = 'none';
                this.nextRewardAmount.innerText = 10 + 5 * possibleStreak;
            } else {
                const remaining = waitTime - timeDiff;
                const h = Math.floor(remaining / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                this.rewardTimer.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                this.rewardTimerLabel.innerText = "Next reward in:";
                this.claimRewardBtn.disabled = true;
                this.claimLockedMsg.style.display = 'block';
            }

            // Update Token Upgrades
            if (this.tUpgBtns && this.tUpgBtns.length > 0) {
              this.tUpgBtns.forEach((btn, i) => {
                if (!btn) return;
                const cost = this.getTokenUpgradeCost(i);
                const lvl = this.tokenUpgrades[i];
                
                const costEl = btn.querySelector('.upg-cost');
                const descEl = btn.querySelector('.upg-desc');
                
                if (lvl >= 100) {
                  btn.classList.add('bought');
                  btn.disabled = true;
                  if (costEl) costEl.innerText = "MAXED";
                } else {
                  btn.classList.remove('bought');
                  btn.disabled = this.tokens < cost;
                  if (costEl) costEl.innerText = `Cost: ${notationChooser(cost)} Tokens`;
                }
                
                if (descEl) {
                  const names = ["Cash Gain", "Multiplier Gain", "Rebirth Gain", "Ultra Gain", "Super Gain", "Energy Gain", "Fragment Gain", "Hyper Gain"];
                  const mult = (i === 0 || i === 1) ? "1.2" : (i === 7) ? "1.05" : "1.1";
                  descEl.innerText = `x${mult} ${names[i]} (${lvl}/100)`;
                }
                
                const totalEl = btn.querySelector('.upg-total');
                if (totalEl) {
                  totalEl.innerText = `Total Boost: x${notationChooser(this.getTokenUpgradeBonus(i), 2)}`;
                }
              });
            }
        }

        // Stat Index: Rune Index disappearing when Tier<7
        if (this.tier < 7) {
          document.getElementById('runeIndexTab').style.display = 'none';
        } else {
          document.getElementById('runeIndexTab').style.display = 'block';
        }
        
        // Update Achievement Cards
        const achCards = {
          goodStart: document.getElementById('ach-goodStart'),
          firstRebirth: document.getElementById('ach-firstRebirth'),
          rebirthEngine: document.getElementById('ach-rebirthEngine'),
          kilowatt: document.getElementById('ach-kilowatt'),
          upgradedProduction: document.getElementById('ach-upgradedProduction'),
          kilofrag: document.getElementById('ach-kilofrag'),
          superfragment: document.getElementById('ach-superfragment'),
          ultraMomentum: document.getElementById('ach-ultraMomentum'),
          supercharged: document.getElementById('ach-supercharged')
        };
        
        for (const [key, card] of Object.entries(achCards)) {
          if (card) {
            if (this.achievements[key]) {
              card.classList.add('unlocked');
            } else {
              card.classList.remove('unlocked');
            }
          }
        }
        
        // Playtime Display (Format H:MM:SS)
        const hours = Math.floor(this.playTime / 3600);
        const minutes = Math.floor((this.playTime % 3600) / 60);
        const seconds = Math.floor(this.playTime % 60);
        this.playTimeDisplay.innerText = `Time Played: ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.optRuneBulk.innerText = "Rune Bulk: " + this.runeBulk;
        this.optRuneLuck.innerText = "Rune Luck: x" + this.runeLuck;
        this.optTtlCash.innerText = "Total Cash: $" + notationChooser(this.ttlcash);
        this.optRuneSpeed.innerText = "You open one rune every " + 1/this.runeSpeed + " seconds";
        this.optTotalRunes.innerText = "Total Runes Opened: " + this.totalRunesOpened;

        if (this.tier < 7) {
          this.optRuneBulk.style.display = 'none';
          this.optRuneLuck.style.display = 'none';
          this.optRuneSpeed.style.display = 'none';
          this.optTotalRunes.style.display = 'none';
        } else {
          this.optRuneBulk.style.display = 'block';
          this.optRuneLuck.style.display = 'block';
          this.optRuneSpeed.style.display = 'block';
          this.optTotalRunes.style.display = 'block';
        }
        
        // Tier display
        this.tierDisplay.innerText = this.tier;
        
        // Update Tier Cards
        const currentTierName = document.getElementById('currentTierName');
        const nextTierName = document.getElementById('nextTierName');
        const currentTierBenefits = document.getElementById('currentTierBenefits');
        const nextTierBenefits = document.getElementById('nextTierBenefits');

        if (currentTierName) currentTierName.innerText = `Tier ${this.tier}`;
        if (nextTierName) nextTierName.innerText = `Tier ${this.tier + 1}`;

        const getTierHTML = (t) => {
        let html = '';
        // Cash
        const cashBase = (t >= 5) ? 2 : 1; 
        const cashMult = new Decimal(1.5).pow(t).mul(cashBase);
        let cashText = `x${notationChooser(cashMult, 2)} Cash (x1.5 per tier`;
        if (t >= 5) cashText += `, x2 Boost`;
        cashText += `)`;
        html += `<div class="benefit-line benefit-green">${cashText}</div>`;
        
        // Multiplier
        let multBase = 1;
        if (t >= 4) multBase = 2;
        const multMult = new Decimal(1.5).pow(t).mul(multBase);
        html += `<div class="benefit-line benefit-red">x${notationChooser(multMult, 2)} Multiplier (x1.5 per tier)</div>`;
        
        // Rebirth
        if (t >= 1) {
            let rebirthText = '';
            let rebBase = 1;
            if (t >= 4) rebBase = 2;
            
            if (t === 2 && this.tier < 2) {
            rebirthText = `x1.2 Rebirth (x1.2 per tier after 1) <br><span class="new-tag">[NEW]</span>`;
            } else if (t >= 2) {
            const rebirthMult = new Decimal(1.2).pow(t - 2).mul(rebBase);
            rebirthText = `x${notationChooser(rebirthMult, 2)} Rebirth (x1.2 per tier after 2)`;
            }
            if (rebirthText) {
            html += `<div class="benefit-line benefit-blue">${rebirthText}</div>`;
            }
        }
        // Ultra
        if (t >= 4) {
            let ultraText = '';
            if (t === 4 && this.tier < 4) {
            // New mechanic unlock
            ultraText = `x1.2 Ultra (x1.2 per tier after 3) <br><span class="new-tag">[NEW]</span>`;
            } else if (t >= 4) {
            const ultraMult = new Decimal(1.2).pow(t - 3);
            ultraText = `x${notationChooser(ultraMult, 2)} Ultra (x1.2 per tier after 3)`;
            }
            if (ultraText) {
            html += `<div class="benefit-line benefit-purple">${ultraText}</div>`;
            }
        }
        // Energy
        if (t === 3) {
            // Unlock
            let energyText = `Unlock Energy (Generates based on Cash & Ultra)`;
            if (this.tier < 3) energyText += ` <br><span class="new-tag">[NEW]</span>`;
            html += `<div class="benefit-line benefit-yellow">${energyText}</div>`;
        } else if (t >= 4) {
            let energyMult = new Decimal(1.5).pow(t - 3);
            // Add note about upgrade boost if applicable? No, just base tier scaling
            html += `<div class="benefit-line benefit-yellow">x${notationChooser(energyMult, 2)} Energy Production (x1.5 per tier after 3)</div>`;
        }
        // Fragments (Tier 5+)
        if (t === 5) {
             let fragText = `Unlock Fragments (Minilayer)`;
             if (this.tier < 5) fragText += ` <br><span class="new-tag">[NEW]</span>`;
             html += `<div class="benefit-line benefit-purple">${fragText}</div>`;
        } else if (t >= 6) {
             const fragMult = new Decimal(1.3).pow(t - 5);
             html += `<div class="benefit-line benefit-purple">x${notationChooser(fragMult, 2)} Fragment Gain (x1.3 per tier after 5)</div>`;
        }
        // Runes (Tier 7+)
        if (t === 7) {
             let fragText = `Unlock Fragment Runes (Gives boosts to most stats)`;
             if (this.tier < 5) fragText += ` <br><span class="new-tag">[NEW]</span>`;
             html += `<div class="benefit-line benefit-purple">${fragText}</div>`;
        }

        if (t === 4) {
            html += "<div class='benefit-line benefit-red'>[NERF] Multiplier cost is now based on Ultra (1.15^Ultra)</div>"
        }
        if (t === 6) {
            html += "<div class='benefit-line benefit-red'>[NERF] Ultra requirement is increased by 3x</div>"
        }
        if (t === 7) {
            html += "<div class='benefit-line benefit-green'>[BUFF] Ultra Multiplier cost base is reduced to 1.04</div>"
        }
        if (t === 4) {
            html += "<div class='benefit-line benefit-green'>[BUFF] x2 Multiplier and Rebirth</div>"
        }
        if (t === 5) {
             html += "<div class='benefit-line benefit-green'>[BUFF] The boost of Energy is stronger</div>"
        }
        return html;
        };

        if (currentTierBenefits) currentTierBenefits.innerHTML = getTierHTML(this.tier);
        if (nextTierBenefits) nextTierBenefits.innerHTML = getTierHTML(this.tier + 1);

        // Use the TIER_REQ_TEXT constant instead of a long if/else chain
        this.tierReq.innerText = TIER_REQ_TEXT[this.tier] || 'You have reached max tier!';
        const energyIndexItem = document.querySelector('.index-item[data-stat="energy"]');
        const fragmentsIndexItem = document.querySelector('.index-item[data-stat="fragments"]');
        const superIndexItem = document.querySelector('.index-item[data-stat="super"]');
        const rebirthIndexItem = document.querySelector('.index-item[data-stat="rebirth"]');
        const ultraIndexItem = document.querySelector('.index-item[data-stat="ultra"]');
        const hyperIndexItem = document.querySelector('.index-item[data-stat="hyper"]');
        if (energyIndexItem) {
            energyIndexItem.style.display = this.tier >= 3 ? 'block' : 'none';
        }
        if (fragmentsIndexItem) {
            fragmentsIndexItem.style.display = this.tier >= 5 ? 'block' : 'none';
        }
        if (superIndexItem) {
            superIndexItem.style.display = (this.ultra.gte(20) || this.super.gt(0)) ? 'block' : 'none';
        }
        if (rebirthIndexItem) {
            rebirthIndexItem.style.display = (this.multiplier.gte(75) || this.rebirthCount.gt(0)) ? 'block' : 'none';
        }
        if (ultraIndexItem) {
            ultraIndexItem.style.display = (this.rebirthCount.gte(10) || this.ultra.gt(0)) ? 'block' : 'none';
        }
        if (hyperIndexItem) {
            hyperIndexItem.style.display = (this.super.gte(50) || this.hyper.gt(0)) ? 'block' : 'none';
        }
        this.tierUpBtn.disabled = !this.canAffordTier();
        const activeIndexItem = document.querySelector('.index-item.active');
        if (activeIndexItem && activeIndexItem.dataset.stat) {
            this.updateIndexDisplay(activeIndexItem.dataset.stat);
        }
        this.saveToStorage();
    } catch (e) {
        console.error("Error in updateDisplay:", e);
    }
  }
  
  // Helper: update a fragment upgrade button's display
  updateFragUpgradeBtn(btn, index, name, maxLevel, desc, totalFn, minTier = 0, totalElId = null) {
    if (!btn) return;
    if (minTier > 0) {
      btn.style.display = this.tier >= minTier ? 'inline-block' : 'none';
      if (this.tier < minTier) return;
    }
    const purchased = this.fragmentUpgradesPurchased[index];
    const cost = this.getFragmentUpgradeCost(index);
    if (purchased >= maxLevel) {
      btn.querySelector('.upg-title').innerText = `${name} (MAXED)`;
      btn.querySelector('.upg-cost').innerText = 'Purchased';
      btn.querySelector('.upg-desc').innerText = '';
      btn.disabled = true;
      btn.classList.add('bought');
    } else {
      btn.querySelector('.upg-title').innerText = `${name} (${purchased}/${maxLevel})`;
      btn.querySelector('.upg-cost').innerText = `Cost: ${notationChooser(cost, 1)} Fragments`;
      btn.querySelector('.upg-desc').innerText = desc;
      btn.disabled = this.fragments.lt(cost);
      btn.classList.remove('bought');
    }
    const totalEl = totalElId ? document.getElementById(totalElId) : btn.querySelector('.upg-total');
    if (totalEl) totalEl.innerText = totalFn(purchased);
  }

  // Select Index Item
  selectIndexItem(element) {
    // Update active class
    document.querySelectorAll('.index-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
    
    // Update display
    this.updateIndexDisplay(element.dataset.stat);
  }
  
  // Update Index Content
  updateIndexDisplay(statKey) {
    // Check lock conditions
    let isLocked = false;
    let lockMessage = "";
    
    if (statKey === 'rebirth' && this.multiplier.lt(75) && this.rebirthCount.eq(0)) {
        isLocked = true;
        lockMessage = "You need 75 Multiplier to unlock it";
    }
    if (statKey === 'ultra' && this.rebirthCount.lt(10) && this.ultra.eq(0)) {
        isLocked = true;
        lockMessage = "You need 10 Rebirths to unlock it";
    }
    if (statKey === 'super' && this.ultra.lt(20) && this.super.eq(0)) {
        isLocked = true;
        lockMessage = "You need 20 Ultra to unlock it";
    }
    if (statKey === 'energy' && this.tier < 3) {
        isLocked = true;
        lockMessage = "You need Tier 3 to unlock it";
    }
    if (statKey === 'fragments' && this.tier < 5) {
        isLocked = true;
        lockMessage = "You need Tier 5 to unlock it";
    }
    if (statKey === 'hyper' && this.super.lt(25) && this.hyper.eq(0)) {
        isLocked = true;
        lockMessage = "You need 25 Super to unlock it";
    }
    if (this.tier >= 3) {
      this.tierUpReset.innerText = ", energy and its Upgrades"
      if (this.tier >= 5) {
        this.tierUpReset.innerText += ", fragment amount and one of each fragment upgrade"
        if (this.tier >= 7) {
          this.tierUpReset.innerText += " and half of the runes"
        }
      }
    } else {
      this.tierUpReset.innerText = ""
    }
    this.tierUpReset.innerText += ". It does not reset Tokens, Achievements, "
    if (this.tier >= 9) {
      this.tierUpReset.innerText += " and Fragment Level"
    }

    
    const data = {
        'cash': {
            title: 'Cash',
            id: '0001',
            desc: 'The primary currency. Used to purchase Multipliers.',
            color: '#22c55e',
            getBoosts: () => `Used to buy things.`
        },
        'multiplier': {
            title: 'Multiplier',
            id: '0002',
            desc: 'Multiplies your cash gain. Cost scales based on current multiplier. Formula: 100 + 50 * Multiplier',
            color: '#ef4444',
            getBoosts: () => `<div style="color: #22c55e">x${notationChooser(this.multiplier.add(1))} Cash Gain (+100% per Multiplier)</div>`
        },
        'rebirth': {
            title: 'Rebirth',
            id: '0003',
            desc: 'Reset your Multiplier and Cash to gain Rebirths, which boost prior stats.<br>Formula: 10 x ((1.3 + Rebirth*0.2 + Ultra*0.4)*Rebirths + 1)',
            color: '#3b82f6',
            getBoosts: () => `
                <div style="color: #22c55e">x${notationChooser(this.getRebirthCashBonus(), 2)} Cash Gain (+10% per Rebirth)</div>
                <div style="color: #ef4444">x${notationChooser(this.rebirthCount.add(1), 0)} Multiplier Gain (+100% per Rebirth)</div>
                <div style="color: #ef4444">x${notationChooser(new Decimal(1).add(this.rebirthCount.div(10)))} Cost for Multiplier (+x0.1 per Rebirth) [NERF]</div>
            `
        },
        'ultra': {
            title: 'Ultra',
            id: '0004',
            desc: 'Hard reset your Rebirths, Multiplier, and Cash to gain an Ultra, which boosts essential stats. A powerful prestige layer.<br>Formula: 10 x (Ultra+1)^1.25',
            color: '#bf00ff',
            getBoosts: () => {
                const scalingBase = this.tier >= 7 ? 1.04 : 1.15;
                return `
                <div style="color: #22c55e">x${notationChooser(this.ultra.mul(1.5).add(1), 2)} Cash Gain (+150% per Ultra)</div>
                <div style="color: #60a5fa">x${notationChooser(this.ultra.add(1), 0)} Rebirth Gain</div>
                ${this.tier > 3 ? `<div style="color: #ef4444">[Tier 4+] x${notationChooser(new Decimal(scalingBase).pow(this.ultra))} Cost for Multiplier (x${scalingBase} per Ultra) [NERF]</div>` : ''}
                `;
            }
        },
        'energy': {
            title: 'Energy',
            id: '0005',
            desc: 'Generated every 15 seconds based on Cash and Ultra. Unlocked at Tier 3. Every Tier from 3 to 5 unlocks 2 new Energy Upgrades.<br>Formula: log10(Cash + 1) * (log2(Ultra + 1) + 1)',
            color: '#facc15',
            getBoosts: () => {
                const boosts = this.getEnergyBoosts();
                return `
                <div style="color: #22c55e">x${notationChooser(boosts.cashBoost, 2)} Cash</div>
                <div style="color: #ef4444">x${notationChooser(boosts.multBoost, 2)} Multiplier</div>
                <div style="color: #3b82f6">x${notationChooser(boosts.rebirthBoost, 2)} Rebirth</div>
                `;
            }
        },
        'tier': {
            title: 'Tier',
            id: '0000',
            desc: 'Your main progression stage. Unlocks new features and provides massive multipliers.',
            color: '#C0C0C0',
            getBoosts: () => `There's a dedicated tab for that!`
        },
        'super': {
            title: 'Super',
            id: '0006',
            desc: 'Reset Cash to Ultra to receive a Super, boosting the last 2 stats. It also boosts energy production, but has a 10% chance to reset Energy on reset.<br>Formula: 20 x (((Super + 1)^1.2 / 2) + 0.5)',
            color: '#15803d',
            getBoosts: () => `
                <div style="color: #bf00ff">x${notationChooser(new Decimal(1).add(this.super.mul(0.5)), 2)} Ultra Gain (+50% per Super)</div>
                <div style="color: #3b82f6">x${notationChooser(new Decimal(1).add(this.super), 0)} Rebirth Gain (+100% per Super)</div>
                <div style="color: #facc15">x${notationChooser(new Decimal(1).add(this.super.mul(0.2)), 2)} Energy Production (+20% per Super)</div>
                <div style="color: #ef4444">x${notationChooser(new Decimal(1.1).pow(this.super), 2)} Cost scaling for all previous stats (x1.1 per Super) [NERF]</div>
            `
        },
        'hyper': {
            title: 'Hyper',
            id: '0008',
            desc: 'The next prestige layer. Reset Cash through Super to gain a Hyper.<br>Cost: 25 Super at base. The highlight is that each Hyper boosts Super by a ton! Also, Hyper has no cost increases to prior stats.<br> Formula: 25 x (Hyper+1)^[1+log(Hyper+1)/2]',
            color: '#383737ff',
            getBoosts: () => `
                <div style="color: #383737ff">x${notationChooser(new Decimal(1).add(this.hyper.mul(2)), 2)} <div style="color: #15803d">Super, <div style="color: #bf00ff">Ultra <div style="color: #ef4444">and Multiplier Gain (+200% per Hyper)</div>
            `
        },
        'fragments': {
            title: 'Fragments',
            id: '0007',
            desc: 'Collected from the Fragments tab. Unlocked at Tier 5. Boosted by Tier 6+. <br> The longer the fragments stay on the field (indicated by the size of the fragment), the more they are worth. But beware, some fragments may despawn earlier than others! Fragments with more corners also worth more.',
            color: '#a855f7',
            getBoosts: () => {
                let fragmentBoost = new Decimal(1);
                if (this.fragments.gte(25)) {
                    fragmentBoost = Decimal.pow(1.07, this.fragments.div(25).log2());
                }
                let boostText = `<div style="color: #facc15">x${notationChooser(new Decimal(1.1).pow(this.fragmentUpgradesPurchased[0]), 2)} Energy Production (Upgrades)</div>`;
                
                if (this.fragments.gte(25)) {
                    boostText += `<div style="color: #bf00ff; white-space: nowrap">x${notationChooser(fragmentBoost, 2)} Ultra Multiplier (1.07^log2(Fragments/50))</div>`;
                } else {
                    boostText += `<div style="color: #666">Ultra Multiplier (Requires 50 Fragments)</div>`;
                }
                
                return boostText;
            }
        }
    };
    
    // Check lock conditions
     if (statKey === 'super' && this.ultra.lt(20) && this.super.eq(0)) {
        isLocked = true;
        lockMessage = "You need 20 Ultra to unlock it";
    }
    
    // Handle Lock
    if (isLocked) {
        this.indexDetailTitle.innerText = "Locked";
        this.indexDetailTitle.style.color = "#888";
        this.indexDetailId.innerText = "ID: ????";
        this.indexDetailDesc.innerText = `[Locked] ${lockMessage}`;
        this.indexDetailBoosts.innerHTML = "";
        return;
    }
    
    const info = data[statKey];
    if (info) {
        this.indexDetailTitle.innerText = info.title;
        this.indexDetailTitle.style.color = info.color;
        this.indexDetailId.innerText = `ID: ${info.id}`;
        this.indexDetailDesc.innerHTML = info.desc; // Use innerHTML for <br>
        this.indexDetailBoosts.innerHTML = info.getBoosts();
    }
  }
}

let game;

window.addEventListener('DOMContentLoaded', () => {
  game = new StatGrindingGame();
});
