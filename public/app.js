// --- CONFIGURATION ---
const SB_URL = 'https://zowcqadrnvlsgodracvx.supabase.co';
const SB_KEY = 'sb_publishable_cJhg_orh-5oTS-DVxTILzw_KtwZTerj';
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let currentUser = JSON.parse(localStorage.getItem('hisab_user')) || null;
let records = JSON.parse(localStorage.getItem('hisab_records')) || [];

// --- AUTH & SESSION MANAGEMENT ---
async function checkSession() {
    if (currentUser) {
        document.getElementById('screen-login').classList.add('hidden');
        document.getElementById('screen-main').classList.remove('hidden');
        updateHeaderAndProfileUI();
        try {
            const { data: user } = await _supabase.from('shop_users').select('*').eq('phone', currentUser.phone).single();
            if (user) {
                currentUser.shopName = user.shop_name; currentUser.bazaar = user.bazaar_name;
                currentUser.address = user.address; currentUser.img = user.image_url;
                localStorage.setItem('hisab_user', JSON.JSON.stringify(currentUser));
                updateHeaderAndProfileUI();
            }
        } catch (e) { console.log("Profile sync failed."); }
        render(); 
        syncFromCloud();
    } else {
        document.getElementById('screen-login').classList.remove('hidden');
        document.getElementById('screen-main').classList.add('hidden');
    }
}

function updateHeaderAndProfileUI() {
    document.getElementById('display-shop-name').innerText = currentUser.shopName;
    const profileImg = document.getElementById('display-profile-img');
    const profilePreview = document.getElementById('profile-img-preview');
    profileImg.src = currentUser.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.shopName)}&background=6366f1&color=fff`;
    if(profilePreview) profilePreview.src = profileImg.src;

    const nameInput = document.getElementById('edit-shop-name');
    const bazaarInput = document.getElementById('edit-bazaar-name');
    const addressInput = document.getElementById('edit-address');
    if(nameInput) nameInput.value = currentUser.shopName;
    if(bazaarInput) bazaarInput.value = currentUser.bazaar || '';
    if(addressInput) addressInput.value = currentUser.address || '';
}

// --- AUTH HANDLERS ---
window.handleAuth = async function() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const shopName = document.getElementById('login-shop-name').value.trim();

    if (!phone || pin.length !== 4) return alert("সঠিক ফোন ও ৪ সংখ্যার পিন দিন");

    try {
        const { data: user } = await _supabase.from('shop_users').select('*').eq('phone', phone).single();
        if (user) {
            if (user.pin === pin) loginSuccess(user);
            else alert("ভুল পিন");
        } else {
            if (!shopName) return alert("দোকানের নাম দিন");
            const { data: newUser, error } = await _supabase.from('shop_users').insert([{ phone, shop_name: shopName, pin }]).select().single();
            if(error) throw error;
            loginSuccess(newUser);
        }
    } catch (e) { alert("সমস্যা: " + e.message); }
};

function loginSuccess(u) {
    currentUser = { shopName: u.shop_name, phone: u.phone, img: u.image_url, bazaar: u.bazaar_name, address: u.address };
    localStorage.setItem('hisab_user', JSON.stringify(currentUser));
    checkSession();
}

window.handleLogout = () => { if(confirm("লগ আউট করবেন?")) { localStorage.clear(); location.reload(); } };

// --- IMAGE UPLOAD ---
window.uploadImage = function(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onloadend = async function() {
        const base64 = reader.result;
        currentUser.img = base64;
        localStorage.setItem('hisab_user', JSON.stringify(currentUser));
        document.getElementById('display-profile-img').src = base64;
        document.getElementById('profile-img-preview').src = base64;
        await _supabase.from('shop_users').update({ image_url: base64 }).eq('phone', currentUser.phone);
    }
    if (file) reader.readAsDataURL(file);
}

// --- PROFILE UPDATE ---
window.updateProfileInfo = async function() {
    const newName = document.getElementById('edit-shop-name').value.trim();
    const newBazaar = document.getElementById('edit-bazaar-name').value.trim();
    const newAddress = document.getElementById('edit-address').value.trim();

    if (!newName) return alert("দোকানের নাম খালি রাখা যাবে না");

    try {
        await _supabase.from('shop_users').update({ shop_name: newName, bazaar_name: newBazaar, address: newAddress }).eq('phone', currentUser.phone);
        currentUser.shopName = newName;
        currentUser.bazaar = newBazaar;
        currentUser.address = newAddress;
        localStorage.setItem('hisab_user', JSON.stringify(currentUser));
        alert("প্রোফাইল আপডেট হয়েছে!");
        switchTab('dashboard');
    } catch (e) { alert("Error: " + e.message); }
};

// --- TRANSACTIONS ---
window.addEntry = async function(type, amountOverride = null, noteOverride = null, custOverride = null) {
    const amt = amountOverride || parseFloat(document.getElementById('amount').value);
    const note = noteOverride || document.getElementById('note').value.trim();
    const cust = custOverride || document.getElementById('customer').value.trim();

    if (!amt || amt <= 0) return alert("টাকা দিন");
    if (type === 'baki' && !cust) return alert("কাস্টমারের নাম দিন");

    const record = {
        id: Date.now(),
        userPhone: currentUser.phone,
        type, amount: amt, 
        note: note || (type === 'sale' ? 'নগদ বিক্রি' : type === 'baki' ? 'বাকি' : type === 'aday' ? 'বাকি আদায়' : 'খরচ'),
        customer: cust || 'নগদ কাস্টমার',
        time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('bn-BD')
    };

    records.unshift(record);
    localStorage.setItem('hisab_records', JSON.stringify(records));
    render();
    if(!amountOverride) {
        document.getElementById('amount').value = ''; 
        document.getElementById('note').value = ''; 
        document.getElementById('customer').value = '';
    }
    await _supabase.from('transactions').insert([{
        user_phone: record.userPhone, amount: record.amount, type: record.type, note: record.note, customer: record.customer
    }]);
};

window.deleteEntry = async function(id) {
    if(!confirm("মুছে ফেলতে চান?")) return;
    records = records.filter(r => r.id !== id);
    localStorage.setItem('hisab_records', JSON.JSON.stringify(records));
    render();
    await _supabase.from('transactions').delete().eq('id', id);
}

window.collectPayment = function(name, total) {
    const pay = prompt(`${name}-এর থেকে কত টাকা আদায় করলেন?`, total);
    if(pay && parseFloat(pay) > 0) {
        window.addEntry('aday', parseFloat(pay), 'বাকি আদায়', name);
        alert("টাকা আদায় হয়েছে!");
        switchTab('dashboard');
    }
}

// --- RENDERING FUNCTIONS ---
function render() {
    const list = document.getElementById('historyList');
    if (!list) return; list.innerHTML = '';
    let sale = 0, exp = 0;
    const today = new Date().toLocaleDateString('bn-BD');

    records.filter(r => r.userPhone === currentUser.phone && r.date === today).forEach(r => {
        if(r.type === 'sale' || r.type === 'baki' || r.type === 'aday') sale += r.amount;
        else exp += r.amount;

        const div = document.createElement('div');
        div.className = 'bg-white p-5 rounded-3xl flex justify-between items-center shadow-sm border border-slate-50 mb-3';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-2 h-10 rounded-full ${r.type === 'sale' ? 'bg-emerald-500' : r.type === 'baki' ? 'bg-amber-500' : r.type === 'aday' ? 'bg-blue-500' : 'bg-rose-500'}"></div>
                <div>
                    <p class="font-bold text-slate-800">${r.customer !== 'নগদ কাস্টমার' ? r.customer : r.note}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">${r.date} • ${r.time}</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <p class="font-black text-lg ${r.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}">
                    ${r.type === 'expense' ? '-' : '+'} ৳${r.amount}
                </p>
                <button onclick="deleteEntry(${r.id})" class="text-slate-200 hover:text-rose-500">🗑️</button>
            </div>
        `;
        list.appendChild(div);
    });
    updateDashboardValues(sale, exp);
}

function renderBaki() {
    const list = document.getElementById('customerList');
    list.innerHTML = '';
    const summary = {};
    const lastDates = {};

    records.filter(r => r.userPhone === currentUser.phone).forEach(r => {
        if(r.type === 'baki') {
            summary[r.customer] = (summary[r.customer] || 0) + r.amount;
            lastDates[r.customer] = r.date;
        }
        if(r.type === 'aday') {
            summary[r.customer] = (summary[r.customer] || 0) - r.amount;
        }
    });

    let total = 0;
    Object.keys(summary).forEach(name => {
        if(summary[name] <= 0) return;
        total += summary[name];
        const div = document.createElement('div');
        div.className = 'bg-white p-6 rounded-[2rem] flex justify-between items-center border border-slate-100 shadow-sm mb-3';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-2 h-8 bg-amber-400 rounded-full"></div>
                <p class="font-black text-slate-800 text-lg">👤 ${name}</p>
            </div>
            <div class="text-right">
                <p class="font-black text-2xl text-amber-600">৳${summary[name]}</p>
                <p class="text-[9px] text-amber-600 font-bold mt-1">📅 শেষ বাকি: ${lastDates[name]}</p>
                <button onclick="collectPayment('${name}', ${summary[name]})" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">টাকা আদায় (Pay)</button>
            </div>
        `;
        list.appendChild(div);
    });
    document.getElementById('totalBaki').innerText = '৳ ' + total;
}

function renderProfile() {
    document.getElementById('edit-shop-name').value = currentUser.shopName;
    document.getElementById('edit-bazaar-name').value = currentUser.bazaar || '';
    document.getElementById('edit-address').value = currentUser.address || '';
    document.getElementById('profile-img-preview').src = currentUser.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.shopName)}&background=6366f1&color=fff`;
}

// --- UTILITIES ---
function updateDashboardValues(sale, exp) {
    document.getElementById('todaySale').innerText = '৳ ' + sale;
    document.getElementById('todayExpense').innerText = '৳ ' + exp;
    document.getElementById('todayProfit').innerText = '৳ ' + (sale - exp);
}

// --- SYNC & TABS ---
async function syncFromCloud() {
    try {
        const { data } = await _supabase.from('transactions').select('*').eq('user_phone', currentUser.phone).order('id', { ascending: false });
        if (data) {
            records = data.map(i => ({
                id: i.id, userPhone: i.user_phone, amount: i.amount, type: i.type, note: i.note, customer: i.customer,
                time: new Date(i.created_at).toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'}),
                date: new Date(i.created_at).toLocaleDateString('bn-BD')
            }));
            localStorage.setItem('hisab_records', JSON.stringify(records));
            render();
        }
    } catch (e) {}
}

window.switchTab = (t) => {
    ['dashboard', 'baki', 'profile', 'report'].forEach(v => {
        const view = document.getElementById(`view-${v}`);
        const nav = document.getElementById(`nav-${v}`);
        if(view) view.classList.add('hidden');
        if(nav) {
            nav.classList.replace('active-tab', 'text-slate-400');
        }
    });
    document.getElementById(`view-${t}`).classList.remove('hidden');
    document.getElementById(`nav-${t}`).classList.add('active-tab');
    document.getElementById(`nav-${t}`).classList.remove('text-slate-400');
    if(t === 'baki') renderBaki();
    if(t === 'profile') renderProfile();
};

// --- REPORT FILTERING ---
window.filterTransactionsByDate = async function() {
    const dateInput = document.getElementById('report-date');
    const date = dateInput.value;
    if (!date) return alert("একটি তারিখ নির্বাচন করুন");

    const reportList = document.getElementById('reportList');
    reportList.innerHTML = '';
    let sale = 0, exp = 0;

    const filteredRecords = records.filter(r => r.userPhone === currentUser.phone && r.date === date);
    
    if(filteredRecords.length === 0) {
        reportList.innerHTML = '<p class="text-center text-slate-400 py-4">এই তারিখে কোনো লেনদেন নেই</p>';
        document.getElementById('reportProfit').innerText = '৳ ০';
        return;
    }

    filteredRecords.forEach(r => {
        if(r.type === 'sale' || r.type === 'baki' || r.type === 'aday') sale += r.amount;
        else exp += r.amount;

        const div = document.createElement('div');
        div.className = 'bg-white p-5 rounded-3xl flex justify-between items-center shadow-sm border border-slate-50 mb-3';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-2 h-10 rounded-full ${r.type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}"></div>
                <div>
                    <p class="font-bold text-slate-800">${r.customer !== 'নগদ কাস্টমার' ? r.customer : r.note}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">${r.time}</p>
                </div>
            </div>
            <p class="font-black text-lg ${r.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}">
                ${r.type === 'expense' ? '-' : '+'} ৳${r.amount}
            </p>
        `;
        list.appendChild(div);
    });

    document.getElementById('reportProfit').innerText = '৳ ' + (sale - exp);
};


checkSession();