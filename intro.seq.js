//@SequenceName: Daily Intro
// vim: foldmethod=marker

//@SequenceCode

//{{{1 Utilities

function dbg(...msg) {
    //console.log(...msg);
}

function DocRegex(re, idx) {
    dbg('Regexing: ' + re);
    var result = re.exec(document.body.innerText);
    dbg('Regex result: ' + result);
    if (idx == undefined || typeof idx != 'number' || result == null) {
        return result;
    } else {
        return result[idx];
    }
}

function DocReInt(re) {
    var str = DocRegex(re, 1).replace(/,/g, '');
    return parseInt(str);
}

function arrEq(arr1, arr2) {
    if (arr1 === arr2)
        return true;
    if (arr1.length !== arr2.length)
        return false;
    for (let i = 0; i < arr1.length; ++i) {
        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

function BvSPlayerId() {
    return $('input[name=player]').value;
}

//{{{ XPath and QuerySelector helpers
function $x(xpath, context=document) {
    var result = document.evaluate(xpath, context, null, 
                                   XPathResult.ANY_UNORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
}

function $$x(xpath, context=document) {
    var result = document.evaluate(xpath, context, null,
                                   XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                   null);
    var retarr = [];
    var res;
    while ((res = result.iterateNext()))
        retarr.push(res);
    return retarr;
}

function $(selector, context=document) {
    return context.querySelector(selector);
}

function $$(selector, context=document) {
    return Array.from(context.querySelectorAll(selector));
}
//}}}

//{{{2 Better team switching (uses quickteams when available)
/**
 * When instantiated on the team page, parses the current team, list of
 * quickteams, available allies. Provides methods for checking availability
 * of allies and switching teams using quickteam when possible.
 */
class TeamPage {
    constructor() {
        const self = this;
        var curteam_node = $x(
            '//b[text()="-Current Team-"]/following-sibling::center');
        self.curteam = [];
        if (curteam_node) {
            self.curteam = $$x('.//td/b', curteam_node)
                .map((node) => node.innerText);
            self.curteam.sort();
        }
        var qteam_labels = $$x('//td[b[text()="QuickTeams"]]/label');
        self.qteams = [];
        for (let i = 1; i < qteam_labels.length; ++i) {
            // dbg(`Label: ${qteam_labels[i].innerText}`);
            let qt = qteam_labels[i].innerText.split(':')[1].split(',')
                .map((s) => s.split('Lvl.')[0].trim());
            if (qt[0] === 'Solo (No Team!)')
                qt = [];
            qt.sort(); // Probably unnecessary but whatever
            let checkid = qteam_labels[i].getAttribute('for');
            self.qteams.push({ team : qt
                             , checkid });
        }
        var ally_labels = $$x('//div[@id="teamrep"]//label[b]');
        self.allies = [];
        for (let i = 0; i < ally_labels.length; ++i) {
            let name = ally_labels[i].innerText.split('(')[0].trim();
            let [base, lvl] = name.split('Lvl.').map((s) => s.trim());
            lvl = parseInt(lvl) || 1;
            let basename = name.split('Lvl.')[0].trim();
            let checkid = ally_labels[i].getAttribute('for');
            self.allies.push({name, basename, lvl, checkid});
        }
        return self;
    }

    hasAlly(name_prefix) {
        return (
            -1 !== this.allies.findIndex(
                (a) => a.name.startsWith(name_prefix)));
    }

    findTeam(...team) {
        let found = new Set();
        for (let i = 0; i < team.length; ++i) {
            let idx = this.allies.findIndex(
                (a, idx) => (a.name.startsWith(team[i]) && !found.has(idx)));
            if (idx === -1)
                return undefined;
            found.add(idx);
        }
        return Array.from(found).map((i) => this.allies[i]);
    }

    _findQteam(team) {
        let basenames = team.map((a) => a.basename);
        basenames.sort();
        dbg('_findQteam basenames: ', basenames);
        return this.qteams.find((qt) => arrEq(basenames, qt.team));
    }

    _matchCurrent(team) {
        let cursorted = this.curteam.slice().sort();
        return arrEq(cursorted, team.map((a) => a.name).sort());
    }

    tryChange(...team) {
        if (team.length > 3)
            return;
        let team_descs = this.findTeam(...team);
        dbg(`Team_descs: `, team_descs);
        if (team_descs == undefined)
            return;
        IncrementTaskIf(this._matchCurrent(team_descs));
        let qt = this._findQteam(team_descs);
        dbg('Qteam: ', qt);
        if (qt) {
            FormCheckById('qteam', qt.checkid);
            FormSubmit('qteam');
        } else {
            for (let ally of team_descs)
                FormCheckById(null, ally.checkid);
            FormSubmit('maketeam');
        }
    }

    /**
     * Like tryChange, but throws an exception upon failure.
     */
    change(...team) {
        this.tryChange(...team);
        throw new Error(`Cannot form team: ${team}`);
    }
}

function TeamChange(...team) {
    GoPage('team');
    if (FormTest('conteam'))
        FormSubmit('conteam');
    var t = new TeamPage();
    (new TeamPage()).change(...team);
}

function TeamTryChange(...team) {
    GoPage('team');
    if (FormTest('conteam'))
        FormSubmit('conteam');
    var t = new TeamPage();
    return (new TeamPage()).tryChange(...team);
}


//2}}}

//{{{ ConsumablesPage
class ConsumablesPage {
    constructor() {
        var foodRows = $$('#oneusediv tr').slice(1);
        this.foods = {};
        for (let row of foodRows) {
            var radio = $('input', row.children[0]);
            var name = $('span', row.children[0]).innerText;
            var num = parseInt(row.children[1].innerText);
            var app = parseInt(row.children[2].innerText);
            this.foods[name] = {radio, num, app};
        }
        this.app = DocReInt(/Appetite Remaining: (\d+)/);
        dbg(this);
    }

    eat(food, max=20) {
        if (!this.foods.hasOwnProperty(food))
            return;
        if (this.foods[food].app > this.app)
            return;
        this.foods[food].radio.checked = true;
        $('input[name=onetimenumber]').value = 20;
        FormSubmit('otime');
    }
}

function Eat(food, max=20) {
    (new ConsumablesPage).eat(food, max);
}
//}}}

//{{{ Extra actions
function FormUncheck(strFormName, strInputName, strInputValue) {
    var strXPath = "";
 
    // Form name is optional, include it if necessary
    if (strFormName)
        strXPath += '//form[@name=\'' + strFormName + '\']';
 
    // Input name is mandatory (else we cannot find the input box...)
    strXPath += '//input[@name=\'' + strInputName + '\'';
 
    // Input value is also optional
    if (strInputValue)
        strXPath += ' and @value=\'' + strInputValue + '\'';
    strXPath += ']';
 
    var elem = document.evaluate(strXPath, document, null, 
                                 XPathResult.ANY_UNORDERED_NODE_TYPE, null)
                                .singleNodeValue;
 
    // Return without action if element does not exist or is disabled
    if (!elem || elem.disabled)
        return false;
 
    // Otherwise check the box and return true
    elem.checked = false;
    return true;
}
 
function FormCheckById(strFormName, strInputId, checked) {
    if (checked == undefined)
        checked = true;
    var strXPath = "";
 
    // Form name is optional, include it if necessary
    if (strFormName)
        strXPath += '//form[@name=\'' + strFormName + '\']';
 
    // Input name is mandatory (else we cannot find the input box...)
    strXPath += '//input[@id=\'' + strInputId + '\']';
 
    var elem = document.evaluate(strXPath, document, null, 
                                 XPathResult.ANY_UNORDERED_NODE_TYPE, null)
        .singleNodeValue;
 
    // Return without action if element does not exist or is disabled
    if (!elem || elem.disabled)
        return false;
 
    // Otherwise check the box and return true
    elem.checked = checked;
    return true;
}
//}}}

//{{{ DailyStorage
/**
 * Returns time & date of dayroll preceding the given timestamp.
 * Argument defaults to current time.
 *
 * Is kind of horrible.
 *
 * Whether it works is probably implementation dependent.
 * In particular, it's implementation dependent what locales and what timezones
 * will be recognized, so the values used here might or might not work.
 *
 * The witchcraft involved will be off by an hour on the days of DST switch in
 * American central timezone, in the dark hours between the moment of the
 * switch and dayroll. This shouldn't make a difference when comparing current
 * time with previous dayroll time. Hopefully.
 */
function LastBvSDayroll(now) {
    const dayroll_time = 5 * 60 * 60 + 15 * 60; // Seconds since midnight
    if (now == undefined)
        now = new Date();
    var tz_opt = { timeZone : 'America/Chicago' };
    var time_str = now.toLocaleTimeString('pl', tz_opt);
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time_str)) {
        throw new Error(
            'LastBvSDayroll: time not in hh:mm:ss format for some reason'
           +` (time_str: ${time_str})`);
    }
    var [hour, min, sec] = time_str.split(':').map((s) => parseInt(s, 10));
    var time_offs = hour * 60 * 60 + min * 60 + sec;
    var dayroll_offs = time_offs - dayroll_time;
    if (dayroll_offs < 0)
        dayroll_offs += 24 * 60 * 60;
    var ret_secs = Math.floor(now.getTime() / 1000) - dayroll_offs;
    return new Date(ret_secs * 1000);
}

/** 
 * Creates a proxy object that forwards property access to local storage.
 * First argument is the prefix used for storage keys.
 * Second argument is the Object of keys/values that should be set at dayroll.
 * Properties are stored as <localstorage_prefix>.<property_name>
 * __last_dayroll__ property is reserved
 */
function DailyStorage(localstorage_prefix, dayroll_vals) {
    var last_store_dayroll_str = 
            localStorage.getItem(`${localstorage_prefix}.__last_dayroll__`);
    var last_store_dayroll = new Date(parseInt(last_store_dayroll_str || 0));
    dbg(`Last stored dayroll for ${localstorage_prefix}:`
       +` ${last_store_dayroll_str}`);
    var last_dayroll = LastBvSDayroll();
    dbg(`Last calculated dayroll: ${last_dayroll.getTime()}`);
    if (last_dayroll> last_store_dayroll) {
        for (let p in dayroll_vals) {
            if (!dayroll_vals.hasOwnProperty(p))
                continue;
            localStorage.setItem(`${localstorage_prefix}.${p}`,
                                 JSON.stringify(dayroll_vals[p]));
        }
        localStorage.setItem(`${localstorage_prefix}.__last_dayroll__`,
                             last_dayroll.getTime());
    }

    function check_prop(prop) {
        if (prop === '__last_dayroll__')
            throw new Error(
                'DailyStorage: __last_dayroll__ property is reserved');
    }

    var handler = {
        set(target, prop, newval) {
            check_prop(prop);
            dbg(`Setting ${localstorage_prefix}.${prop} to ${newval}`);
            localStorage.setItem(`${localstorage_prefix}.${prop}`, 
                                 JSON.stringify(newval));
        },
        get(target, prop) {
            var ret = JSON.parse(
                localStorage.getItem(`${localstorage_prefix}.${prop}`));
            dbg(`Getting ${ret} from ${localstorage_prefix}.${prop}`);
            return ret;
        },
        deleteProperty(target, prop) {
            check_prop(prop);
            localStorage.removeItem(`${localstorage_prefix}.${prop}`);
        }
    };
    return new Proxy({}, handler);
}

/** 
 * Wraps around DailyStorage. Adds -<playername> to the prefix.
 */
function PlayerStorage(localstorage_prefix, dayroll_vals) {
    return DailyStorage(localstorage_prefix + '-' + BvSPlayerId(),
                        dayroll_vals);
}
//}}}

//1}}}

//@NewTask
//@TaskName: Awesome cat
GoPage('main');
IncrementTaskIf(!DocTest('Look at this cat.'));
FormSetValue('videochallenge', 'videoroll', 'yes');
FormSubmit('videochallenge');

//@NewTask
//@TaskName: Bonus code
GoPage('main');
IncrementTaskIf(!DocRegex(/Collect your Bonus Stamina/));
$('input[name=bonusget]').scrollIntoView();
ShowMsg('Type ze bonus code.');

//@NewTask
//@TaskName: Breakfast bingo

GoPage('breakfast');

IncrementTaskIf(DocTest('Breakfast Results:')
                || DocTest('Breakfast has been served!'));

FormCheck('dobfast', 'bfconfirm');
FormCheck('dobfast', 'tr-bfast');

FormCheck('dobfast', 'bingo-b1');
FormUncheck('dobfast', 'bingo-b2');
FormCheck('dobfast', 'bingo-b3');
FormUncheck('dobfast', 'bingo-b4');
FormCheck('dobfast', 'bingo-b5');

FormSubmit('dobfast');

//@NewTask
//@TaskName: Retail bonus
GoPage('retail');
IncrementTaskIf(!FormCheck('spendwage', 'buywage', 'rt_pachibuy'));
FormSubmit('spendwage');
//ShowMsg('Buy pachinko bonus');

//@NewTask
//@TaskName: Shorty

TeamChange('Shorty');

//@NewTask
//@TaskName: Party

GoPage('ph_partyroom');
IncrementTaskIf(!DocTest('Parties today: 0'));
FormCheck('pr', 'partytype', 'Bash');
FormSubmit('pr');

//@NewTask
//@TaskName: Pachinko

// Test if we're at machine.
if (LocationTest('partyhouse-pachinkoplay.html')) {
    // End if used all balls
    IncrementTaskIf(DocTest('Electrum: 0'));
    // Otherwise, keep using
    (function () {
        var regex = /Electrum: (\d+)/;
        var balls = parseInt(regex.exec(document.body.innerHTML)[1]);
        FormSelect('dropball', 'wheredrop', 1);
        if (FormSetValue('dropball', 'numdrop', Math.min(balls, 1000)))
            FormSubmit('dropball');
    })();
}

// Else navigate to page
GoPage('ph_pachinko');
if (DocTest('You survey the rows of machines, including the ominous one'
           +' in the back')) {
    FormSubmit('startpc');
}
// Buy balls
if (DocTest('Buys today: 0')) {
    FormCheck('buyballs', 'rp_bonus');
    FormSubmit('buyballs');
}
// Goto first machine
if (FormCheckById('playapachi', 'pmach1'))
    FormSubmit('playapachi');

//@NewTask
//@TaskName: Tsukiball

GoPage('ph_tsukiball');

if (FormCheck('skic', 'tixtype', 'plastic'))
    FormSubmit('skic');

if (DocTest('You are on Ball')) {
    FormCheck('skib', 'rolltype', 'high');
    FormCheck('skib', 'doemall');
    FormSubmit('skib');
} else if (!DocTest('Final Score:')) {
    FormSelect('skib', 'megatsuki', false, 'Play a MegaGame');
    FormSubmit('skib');
}

IncrementTask();

/* Pointlessu
//NewTask
//@TaskName: Summoning

GoPage('summons');
IncrementTaskIf(!FormCheck('summonsummon', 'summonname', 'Sickle Weasel'))
FormSubmit('summonsummon');
*/

//@NewTask
//@TaskName: Strawberry Team

TeamTryChange('Strawberry Lvl. 3', 'Robogirl Lvl. 3');
TeamChange('Strawberry', 'Shorty', 'Robogirl');

//@NewTask
//@TaskName: Arena stuff

GoPage('arena');

if (DocTest('buy-ins so far today: 0')) {
    FormCheck('buytfights', 'buyfights');
    FormSubmit('buytfights');
}
/*
        || DocTest('buy-ins so far today: 1')
        || DocTest('buy-ins so far today: 2')
    FormSubmit('buyfights');
*/

IncrementTaskIf(!DocTest('Fights today: <b>0</b>'));

FormCheck('arenafight', 'megaarena');
FormSubmit('arenafight');

/* 11-tails is summoned. Can't do this for nao.
//NewTask
//@TaskName: Fight kaiju

GoPage('kaiju');

if (!DocTest("You had this Kaiju's drop"))
    ShowMsg("ZOMG, drop you don't have yet. Do this manually.");

var times = DocReInt(/times fought today: (\d+)/);
IncrementTaskIf(times >= 6);

if (times < 4) {
    FormCheck('kat', 'tsukiball');
} else {
    FormUncheck('kat', 'tsukiball');
}
if (!DocTest('Crippled!')) {
    var jutsu = 'Bring Down the House Jutsu';
    var jutsuCost = DocReInt(new RegExp(jutsu + ' \\((\\d+) C\\)'));
    dbg('Cost: ' + jutsuCost);
    var chakra = DocReInt(/Chakra: (\d+)/);
    if (jutsuCost > chakra)
        FormSubmit('chakra');
    FormCheck('kat', 'jutsuused', jutsu);
} else {
    FormCheck('kat', 'jutsuused', 'none');
}
FormSubmit('kat');
*/

/* Black Stones bonuses aren't worth the extra hassle.
//NewTask
//@TaskName: Switching to solo

TeamChange();
*/

//@NewTask
//@TaskName: Village actions

GoPage('village');

// Bodacious park
if (DocTest('Check out Bodacious Park!'))
    FormSubmit('bpark');

// Paperwork or collect
if (!(DocTest('You are already helping out your Village today')
        || DocTest('You are helping a Village out today'))) {
    var upkeep = DocReInt(/Current Upkeep: (\d+)%/);
    var paperwork = DocReInt(/Paperwork:\D*(\d+)% Upkeep Tomorrow/);
    dbg('Upkeep detected: ' + upkeep);
    dbg('Paperwork detected: ' + paperwork);
    if (paperwork < upkeep) {
        FormSubmit('paperwork');
    } else {
        if (DocTest('Resupply the Z-Fighters')) {
            FormSubmit('zatrs');
        } else {
            FormSubmit('rescol');
        }
    }
}

// Ingredients, lemonade, library
if (!DocTest('Already Searched Today!')) {
    FormCheck('ingredienthunt', 'ingredientplace', 'forest');
    FormCheck('ingredienthunt', 'gothgoth');
    FormSubmit('ingredienthunt');
}
if (DocTest('Have some tasty Lemonade!')) {
    FormSubmit('lemonaid');
}
/* Nope
if (DocTest('Go to a Black Stones Concert!'))
    FormSubmit('blackstones');
*/
/* Pointless with max level.
if (DocTest('Study at the Pandora Library!'))
    FormSubmit('pandtime');
*/
if (FormCheck('ramen', 'ramentobuy', 'app'))
    FormSubmit('ramen');

IncrementTask();

/* Pointless with so few moniez
//NewTask
//@TaskName: Credit pull

GoPage('marketplace');
IncrementTaskIf(DocTest('Used Today!'));
FormSubmit('freepull');
*/

//@NewTask
//@TaskName: PizzaWitch

GoPage('pizzawitch');
if (!DocTest("Work a shift on the other Riders' Rides"))
    FormSubmit('workinback');

var deliveries = DocReInt(/Delivery \((\d+) Remaining\)/);
IncrementTaskIf(deliveries === 0);

var tips_str = DocRegex(/Current Tips: ([0-9,]+)/, 1).replace(',','');
var tips = parseInt(tips_str);
var bribe = DocReInt(/\bBribe[^(]*\(-([\d,]+) Tips\/Shift/);
var max_bribes = Math.trunc(tips / bribe);
FormCheck('doshift', 'shiftbribe', 1);
FormSetValue('doshift', 'shiftcount', Math.min(deliveries, max_bribes));
FormSubmit('doshift');

//@NewTask
//@TaskName: Tattoo thing
// Grinding for ze trophy

GoPage('tattoo');
IncrementTaskIf(DocTest('Action done today!'));
FormCheckById('tattootrain', 'tuptat');
FormSubmit('tattootrain');

//@NewTask
//@TaskName: Field actions

GoPage('fields');

var store = PlayerStorage('daily_fields', { drawn_essence : false
                                          , did_actions   : false });

// We either start on the essence field, in which case we want to draw,
// go to farming field and spend free actions. Or we start on the farming 
// field and we want to spend actions first to avoid double field change.
// Persistent storage is required to do this, I think.

if (DocTest('Use Field Oscillator'))
    FormSubmit('oscillator');
if (DocTest('Enough has collected to fill a single vial'))
    FormSubmit('lifestream');
if (DocTest('No more Essence can be collected today')) {
    store.drawn_essence = true;
    IncrementTaskIf(store.did_actions);
    // ShowMsg('b-d-p'); 
    SetField('Brilliant', 'Delicious', 'Paradise');
}
if ($('form[name=search1]')) {
    if (!DocTest('Free Actions:')) {
        store.did_actions = true;
        IncrementTaskIf(store.drawn_essence);
        // ShowMsg('b-d-d'); 
        SetField('Brilliant', 'Delicious', 'Dance Floor');
    }
    var free_acts = DocReInt(/Free Actions: (\d+)/);
    if (free_acts >= 10 && DocTest('Turn MegaActions On')
            || DocTest('x50 Stamina / FA cost')
            || free_acts < 10 && DocTest('Turn MegaActions Off')) {
        FormSubmit('megaactionflip');
    } else {
        FormSubmit('search1');
    }
}

//@NewTask
//@TaskName: Nom team

// TeamChange('Tsukasa', 'Yuki');
TeamChange('TACOS', 'Tsukasa', 'Cipher');

//@NewTask
//@TaskName: Nomming

GoPage('consumables');
Eat('TACO');
IncrementTask();

//@NewTask
//@TaskName: Retail
GoPage('retail');
ShowMsg('Do the thing.');

//@NewTask
//@TaskName: Larry und Haro

TeamChange('Larry', 'Haro');

//@NewTask
//@TaskName: Run missions

GoPage('missions');
if (LocationTest('missionstart.html')) {
    if ($('form[name=misforms]'))
        FormSubmit('misforms');
    if (DocTest('MegaMissions (Inactive)'))
        FormSubmit('megamis');
    FormSubmit('misformwasteland');
}

if (LocationTest('mission1.html') && DocTest('Only One S-Rank per day!')) {
    FormSubmit('backmission');
}

ShowMsg('Smash those hotkeys');
