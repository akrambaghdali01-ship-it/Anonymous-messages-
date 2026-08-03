import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, where } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDFDCFWfz252j7N1D6HpaP42FGU64gc058",
    authDomain: "sarahne-app.firebaseapp.com",
    projectId: "sarahne-app",
    storageBucket: "sarahne-app.firebasestorage.app",
    messagingSenderId: "117708812167",
    appId: "1:117708812167:web:c868ddee5e12d247b0ad22"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 🟢 1. قيم افتراضية وإمكانية جلبها من LocalStorage كاحتياط سريع
let EMAILJS_PUBLIC_KEY = localStorage.getItem('emailjs_public_key') || "BelT0PlpYzXma3XxB";
let EMAILJS_SERVICE_ID = localStorage.getItem('emailjs_service_id') || "service_2h2rhme"; 
let EMAILJS_TEMPLATE_ID = localStorage.getItem('emailjs_template_id') || "template_84nynjn"; 

// 🟢 2. دالة جلب إعدادات EmailJS من Firebase Firestore
async function loadEmailJSConfigFromFirebase() {
    try {
        const configRef = doc(db, "settings", "emailjs");
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            EMAILJS_PUBLIC_KEY = data.publicKey || EMAILJS_PUBLIC_KEY;
            EMAILJS_SERVICE_ID = data.serviceId || EMAILJS_SERVICE_ID;
            EMAILJS_TEMPLATE_ID = data.templateId || EMAILJS_TEMPLATE_ID;

            // تحديث التخزين المحلي
            localStorage.setItem('emailjs_public_key', EMAILJS_PUBLIC_KEY);
            localStorage.setItem('emailjs_service_id', EMAILJS_SERVICE_ID);
            localStorage.setItem('emailjs_template_id', EMAILJS_TEMPLATE_ID);
        }

        // تفعيل EmailJS
        if (window.emailjs && EMAILJS_PUBLIC_KEY) {
            emailjs.init(EMAILJS_PUBLIC_KEY);
        }
    } catch (error) {
        console.warn("تعذر جلب إعدادات EmailJS من Firebase، سيتم الاعتماد على القيم المحلية:", error);
        if (window.emailjs && EMAILJS_PUBLIC_KEY) {
            emailjs.init(EMAILJS_PUBLIC_KEY);
        }
    }
}

// متغيرات حفظ الرمز والبيانات المؤقتة
let generatedOTP = null;
let pendingUserCredentials = null;

let currentUser = null;
let selectedRecipient = null;
let messages = [];
let uploadedImageBase64 = null;
let tempAvatarBase64 = null;
let allUsersList = [];

const presetAvatars = [
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Aiden",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Robot1",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Luna",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Cyber2",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Mia",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Alex",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Ryan",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Adam",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Sara",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Noah",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Olivia",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Layla",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Yasmine",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Alpha",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Neo",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Cyber",
    "https://api.dicebear.com/7.x/bottts/svg?seed=RoboX"
];

document.addEventListener("DOMContentLoaded", async () => {
    await loadEmailJSConfigFromFirebase();
    renderPresetsGrid();
});

// 🛠️ دوال التحكم في لوحة إعدادات EmailJS
window.openEmailJSConfig = function() {
    document.getElementById('cfg-public-key').value = EMAILJS_PUBLIC_KEY;
    document.getElementById('cfg-service-id').value = EMAILJS_SERVICE_ID;
    document.getElementById('cfg-template-id').value = EMAILJS_TEMPLATE_ID;
    document.getElementById('emailjs-config-modal').style.display = 'flex';
};

window.closeEmailJSConfig = function() {
    document.getElementById('emailjs-config-modal').style.display = 'none';
};

// 🟢 حفظ إعدادات EmailJS في LocalStorage + Firebase Firestore
window.saveEmailJSConfig = async function() {
    const pubKey = document.getElementById('cfg-public-key').value.trim();
    const srvId = document.getElementById('cfg-service-id').value.trim();
    const tmpId = document.getElementById('cfg-template-id').value.trim();

    if(!pubKey || !srvId || !tmpId) {
        showToast("يرجى ملء جميع الحقول الخاصّة بإعدادات EmailJS!");
        return;
    }

    try {
        showToast("جاري حفظ الإعدادات... ⏳");

        // 1. الحفظ في LocalStorage أولاً
        localStorage.setItem('emailjs_public_key', pubKey);
        localStorage.setItem('emailjs_service_id', srvId);
        localStorage.setItem('emailjs_template_id', tmpId);

        EMAILJS_PUBLIC_KEY = pubKey;
        EMAILJS_SERVICE_ID = srvId;
        EMAILJS_TEMPLATE_ID = tmpId;

        if (window.emailjs) {
            emailjs.init(EMAILJS_PUBLIC_KEY);
        }

        // 2. الحفظ في Firebase Firestore
        try {
            await setDoc(doc(db, "settings", "emailjs"), {
                publicKey: pubKey,
                serviceId: srvId,
                templateId: tmpId,
                updatedAt: Date.now()
            });
        } catch (fbErr) {
            console.warn("لم يتسنى الحفظ في الفايربيس، تم الاكتفاء بالحفظ المحلي:", fbErr);
        }

        closeEmailJSConfig();
        showToast("تم حفظ الإعدادات بنجاح! 🔥🚀");

    } catch (error) {
        console.error("خطأ الحفظ:", error);
        showToast("حدث خطأ أثناء حفظ الإعدادات ❌");
    }
};

// 🟢 دالة التبديل المُصلحة بين واجهتي تسجيل الدخول وحساب جديد
window.switchAuthMode = function(mode) {
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const loginBtnTab = document.getElementById('tab-login-btn');
    const regBtnTab = document.getElementById('tab-reg-btn');

    if (!loginForm || !registerForm) return;

    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    if(loginBtnTab) loginBtnTab.classList.remove('active');
    if(regBtnTab) regBtnTab.classList.remove('active');

    if (mode === 'login') {
        loginForm.style.display = 'block';
        if(loginBtnTab) loginBtnTab.classList.add('active');
    } else if (mode === 'register') {
        registerForm.style.display = 'block';
        if(regBtnTab) regBtnTab.classList.add('active');
    }
};

window.handleEmailLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value.trim();

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        showToast("تم تسجيل الدخول بنجاح! 🚀");
    } catch (error) {
        alert("خطأ الدخول: " + error.message);
    }
};

// 🔑 دالة استعادة كلمة المرور عبر Firebase
window.handleForgotPassword = async function() {
    const email = document.getElementById('login-email').value.trim();
    
    if (!email) {
        showToast("الرجاء كتابة بريدك الإلكتروني في خانة تسجيل الدخول أولاً! ✉️");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showToast("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني! 🔗 تفقد صندوق الوارد.");
    } catch (error) {
        console.error("خطأ استعادة كلمة المرور:", error);
        alert("حدث خطأ: " + error.message);
    }
};

// 🟢 إنشاء حساب وإرسال الرمز عبر EmailJS
window.handleEmailRegister = async function(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value.trim();

    if (pass.length < 6) {
        showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل!");
        return;
    }

    if (typeof emailjs === 'undefined') {
        alert("خطأ: سكربت EmailJS غير محمل في ملف index.html!");
        return;
    }

    if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
        alert("تنبيه: يرجى إدخال وتأكيد إعدادات EmailJS أولاً!");
        openEmailJSConfig();
        return;
    }

    try {
        emailjs.init(EMAILJS_PUBLIC_KEY);

        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        pendingUserCredentials = { name, email, pass };

        showToast("جاري إرسال الرمز إلى إيميلك... ⏳");

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: email,
            to_name: name,
            otp_code: generatedOTP
        });

        document.getElementById('otp-modal').style.display = 'flex';
        showToast("تم إرسال رمز التأكيد! ✉️ تفقد صندوق الوارد.");

    } catch (error) {
        console.error("خطأ EmailJS التفصيلي:", error);
        const errorDetail = error.text || error.message || JSON.stringify(error);
        alert("حدث خطأ في إرسال الرمز: " + errorDetail);
    }
};

// 🟢 التأكيد من الرمز المدخل وإنشاء الحساب في Firebase
window.verifyOTP = async function() {
    const userEnteredOTP = document.getElementById('otp-input').value.trim();

    if (!userEnteredOTP) {
        showToast("الرجاء أدخل الرمز المكون من 6 أرقام!");
        return;
    }

    if (userEnteredOTP === generatedOTP) {
        try {
            const { name, email, pass } = pendingUserCredentials;
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            const user = cred.user;

            const newUser = {
                uid: user.uid,
                name: name,
                handle: `@${email.split('@')[0]}`,
                bio: "أهلاً بكم في حسابي للرسائل السرية! 💎✨",
                avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
                theme: "default"
            };
            await setDoc(doc(db, "users", user.uid), newUser);

            document.getElementById('otp-modal').style.display = 'none';
            document.getElementById('otp-input').value = "";
            showToast("تم تأكيد الحساب بنجاح! 🎉 مرحبا بك.");

            generatedOTP = null;
            pendingUserCredentials = null;

        } catch (error) {
            alert("خطأ في إنشاء الحساب: " + error.message);
        }
    } else {
        showToast("❌ الرمز غير صحيح! حاول مجدداً.");
    }
};

// 🟢 مراقب حالة الجلسة
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await syncUserToDatabase(user);
    } else {
        currentUser = null;
        document.documentElement.removeAttribute("data-palette");
        document.getElementById('view-auth').classList.add('active');
        document.getElementById('view-inbox').classList.remove('active');
        document.getElementById('view-search').classList.remove('active');
        document.getElementById('view-send').classList.remove('active');
        document.getElementById('nav-bar').style.display = 'none';
    }
});

async function syncUserToDatabase(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        currentUser = userSnap.data();
    } else {
        currentUser = {
            uid: user.uid,
            name: user.displayName || "مستخدم جديد",
            handle: `@${user.email ? user.email.split('@')[0] : 'user'}`,
            bio: "أهلاً بكم في حسابي للرسائل السرية! 💎✨",
            avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
            theme: "default"
        };
        await setDoc(userRef, currentUser);
    }

    applySavedTheme(currentUser.theme);
    initAppUI();
}

function applySavedTheme(themeName) {
    if (themeName && themeName !== "default") {
        document.documentElement.setAttribute("data-palette", themeName);
    } else {
        document.documentElement.removeAttribute("data-palette");
    }
}

document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        alert("خطأ جوجل: " + error.message);
    });
});

window.logout = function() {
    signOut(auth).then(() => {
        showToast("تم تسجيل الخروج بنجاح");
    });
};

window.saveCloudProfile = async function() {
    if (!currentUser) return;
    const newName = document.getElementById('edit-name-input').value.trim();
    const newHandle = document.getElementById('edit-handle-input').value.trim();
    const newBio = document.getElementById('edit-bio-input').value.trim();

    if (!newName) {
        showToast("الرجاء إدخال الاسم على الأقل!");
        return;
    }

    const updatedData = {
        name: newName,
        handle: newHandle.startsWith('@') ? newHandle : `@${newHandle}`,
        bio: newBio,
        avatar: tempAvatarBase64 || currentUser.avatar
    };

    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, updatedData);
        currentUser = { ...currentUser, ...updatedData };
        updateProfileUI();
        closeEditModal();
        showToast("تم تحديث وحفظ الملف الشخصي بنجاح! ✨");
    } catch (error) {
        showToast("حدث خطأ أثناء حفظ التعديلات.");
    }
};

window.sendCloudMessage = async function() {
    const text = document.getElementById('send-input').value.trim();
    const btn = document.getElementById('sendBtn');

    if (!text && !uploadedImageBase64) {
        showToast("الرجاء كتابة رسالة أو إرفاق صورة!");
        return;
    }

    if (!selectedRecipient) {
        showToast("الرجاء اختيار مستلم أولاً من قائمة البحث!");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "جاري الإرسال ...";

        await addDoc(collection(db, "messages"), {
            recipientUid: selectedRecipient.uid,
            text: text || "",
            img: uploadedImageBase64 || null,
            time: new Date().toLocaleString(),
            timestamp: Date.now(),
            isPinned: false,
            reply: null
        });

        document.getElementById('send-input').value = "";
        document.getElementById('image-preview').style.display = 'none';
        uploadedImageBase64 = null;
        showToast("تم إرسال الصراحة بنجاح ! 🚀");
        switchTab('search', document.querySelectorAll('.nav-item')[1]);
    } catch (error) {
        showToast("حدث خطأ أثناء الإرسال.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال الصراحة الآن أونلاين';
    }
};

window.fetchCloudMessages = async function() {
    if (!currentUser) return;
    try {
        const q = query(
            collection(db, "messages"), 
            where("recipientUid", "==", currentUser.uid),
            orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        messages = [];
        querySnapshot.forEach((docItem) => {
            messages.push({ id: docItem.id, ...docItem.data() });
        });

        messages.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.timestamp - a.timestamp;
        });

        renderMessages();
    } catch (error) {
        console.error("خطأ جلب الرسائل:", error);
    }
};

window.fetchAllUsers = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersList = [];
        querySnapshot.forEach((docItem) => {
            const data = docItem.data();
            if(currentUser && data.uid !== currentUser.uid) {
                allUsersList.push(data);
            }
        });
        renderUsersList(allUsersList);
    } catch (error) {
        console.error("خطأ جلب المستخدمين:", error);
    }
};

window.deleteCloudMessage = async function(id) {
    try {
        await deleteDoc(doc(db, "messages", id));
        showToast("تم حذف الرسالة بنجاح");
        fetchCloudMessages();
    } catch (error) {
        console.error("خطأ الحذف:", error);
    }
};

window.updateCloudReply = async function(id, replyText) {
    try {
        const docRef = doc(db, "messages", id);
        await updateDoc(docRef, { reply: replyText });
        showToast("تمت إضافة الرد بنجاح! 💬");
        fetchCloudMessages();
    } catch (error) {
        console.error("خطأ الرد:", error);
    }
};

window.toggleCloudPin = async function(id, currentStatus) {
    try {
        const docRef = doc(db, "messages", id);
        await updateDoc(docRef, { isPinned: !currentStatus });
        fetchCloudMessages();
    } catch (error) {
        console.error("خطأ التثبيت:", error);
    }
};

function initAppUI() {
    document.getElementById('view-auth').classList.remove('active');
    updateProfileUI();
    document.getElementById('nav-bar').style.display = 'flex';
    switchTab('inbox', document.querySelectorAll('.nav-item')[0]);
    fetchCloudMessages();
    fetchAllUsers();
}

function updateProfileUI() {
    if (!currentUser) return;
    document.getElementById('display-name').innerText = currentUser.name;
    document.getElementById('display-handle').innerText = currentUser.handle;
    document.getElementById('display-bio').innerText = currentUser.bio;
    document.getElementById('display-avatar').src = currentUser.avatar;
}

function renderPresetsGrid() {
    const container = document.getElementById('presets-container');
    if (!container) return;

    const visibleCount = 8;

    container.innerHTML = presetAvatars.map((url, index) => `
        <img 
            src="${url}" 
            class="preset-avatar avatar-item"
            data-index="${index}"
            style="${index >= visibleCount ? 'display:none;' : ''}"
            onclick="selectPresetAvatar('${url}')"
        >
    `).join('');

    if (presetAvatars.length > visibleCount) {
        container.innerHTML += `
            <button
                type="button"
                id="show-more-avatars"
                class="action-btn"
                style="width:100%; margin-top:10px;"
                onclick="toggleMoreAvatars()"
            >
                <i class="fa-solid fa-chevron-down"></i>
                عرض المزيد
            </button>
        `;
    }
}

window.toggleMoreAvatars = function() {
    const avatars = document.querySelectorAll('.avatar-item');
    const button = document.getElementById('show-more-avatars');

    const hiddenAvatars = [...avatars].filter(
        avatar => avatar.style.display === 'none'
    );

    if (hiddenAvatars.length > 0) {
        hiddenAvatars.forEach(avatar => {
            avatar.style.display = 'block';
        });

        button.innerHTML = `
            <i class="fa-solid fa-chevron-up"></i>
            إخفاء الأفتارات
        `;
    } else {
        avatars.forEach((avatar, index) => {
            if (index >= 8) {
                avatar.style.display = 'none';
            }
        });

        button.innerHTML = `
            <i class="fa-solid fa-chevron-down"></i>
            عرض المزيد
        `;
    }
};

window.selectPresetAvatar = function(url) {
    tempAvatarBase64 = url;
    document.getElementById('edit-preview-avatar').src = url;
    showToast("تم اختيار الأفتار بنجاح!");
};

window.togglePaletteMenu = function() {
    const paletteMenu = document.getElementById('palette-menu');
    if (paletteMenu) {
        paletteMenu.classList.toggle('show');
    }
};

window.openPaletteModal = function() {
    document.getElementById('palette-menu')?.classList.remove('show');
    document.getElementById('palette-modal')?.classList.add('active');
};

window.closePaletteModal = function() {
    document.getElementById('palette-modal')?.classList.remove('active');
};

window.changePalette = async function(themeName) {
    if (!currentUser) {
        showToast("لازم تسجل الدخول أولاً ❌");
        return;
    }

    try {
        applySavedTheme(themeName);

        await setDoc(
            doc(db, "users", currentUser.uid),
            { theme: themeName },
            { merge: true }
        );

        currentUser = {
            ...currentUser,
            theme: themeName
        };

        document.getElementById('palette-menu')?.classList.remove('show');
        window.closePaletteModal();

        showToast("تم حفظ اللون بنجاح 🎨");

    } catch (error) {
        console.error("خطأ حفظ الثيم:", error);
        showToast("فشل حفظ اللون ❌");
    }
};

window.renderUsersList = function(users) {
    const listEl = document.getElementById('search-results');
    if(!listEl) return;
    if(!users || users.length === 0) {
        listEl.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">لا يوجد مستخدمون آخرون مسجلون حالياً</p>`;
        return;
    }
    listEl.innerHTML = users.map(user => `
        <div class="glass-card" style="display:flex; align-items:center; gap:12px; cursor:pointer; margin-bottom:10px;" onclick='openSendToUser(${JSON.stringify(user)})'>
            <img src="${user.avatar}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
            <div style="flex:1;">
                <div style="font-weight:bold;">${user.name}</div>
                <div style="font-size:12px; color:var(--text-sub);">${user.handle}</div>
            </div>
            <i class="fa-solid fa-paper-plane"></i>
        </div>
    `).join('');
};

window.handleSearch = function() {
    const queryText = document.getElementById('search-input').value.toLowerCase().trim();
    const filtered = allUsersList.filter(u => u.name.toLowerCase().includes(queryText) || u.handle.toLowerCase().includes(queryText));
    renderUsersList(filtered);
};

window.openSendToUser = function(user) {
    selectedRecipient = user;
    document.getElementById('recipient-name').innerText = `أرسل صراحة إلى: ${user.name}`;
    document.getElementById('recipient-handle').innerText = user.handle;
    document.getElementById('recipient-avatar').src = user.avatar;
    switchTab('send', null);
};

window.renderMessages = function() {
    const listEl = document.getElementById('messages-list');
    if(!listEl) return;
    if (!messages || messages.length === 0) {
        listEl.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد رسائل في الوقت الحالي 😔</p>`;
        return;
    }

    listEl.innerHTML = messages.map(msg => `
        <div class="glass-card ${msg.isPinned ? 'pinned' : ''}">
            ${msg.isPinned ? `<div style="font-size:11px; color:#f59e0b; margin-bottom:6px; font-weight:bold;"><i class="fa-solid fa-thumbtack"></i> مثبتة في الأعلى</div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-sub); margin-bottom:10px;">
                <span>مجهول 🔒</span>
                <span>${msg.time || ''}</span>
            </div>
            <div style="font-size:15px; margin-bottom:10px;">${escapeHtml(msg.text || '')}</div>
            ${msg.img ? `<img src="${msg.img}" style="width:100%; border-radius:12px; margin-bottom:10px;">` : ''}

            ${msg.reply ? `
                <div class="reply-box">
                    <div class="reply-header"><i class="fa-solid fa-reply"></i> ردك:</div>
                    <div>${escapeHtml(msg.reply)}</div>
                </div>
            ` : `
                <div id="reply-form-${msg.id}" style="display:none; gap:8px; margin-top:10px;">
                    <input type="text" id="reply-input-${msg.id}" class="glass-input" style="margin:0; font-size:12px;" placeholder="اكتب ردك هنا...">
                    <button class="btn-main" style="width:auto; padding:8px 15px;" onclick="submitReply('${msg.id}')">رد</button>
                </div>
            `}

            <div class="card-actions">
                <button class="action-btn ${msg.isPinned ? 'active-pin' : ''}" onclick="toggleCloudPin('${msg.id}', ${msg.isPinned})">
                    <i class="fa-solid fa-thumbtack"></i> ${msg.isPinned ? 'إلغاء' : 'تثبيت'}
                </button>
                <button class="action-btn" onclick="toggleReply('${msg.id}')">
                    <i class="fa-solid fa-comment-dots"></i> ${msg.reply ? 'تعديل' : 'رد'}
                </button>
                <button class="action-btn" onclick="openStoryModal('${escapeHtml(msg.text || '')}', '${msg.img || ''}', '${escapeHtml(msg.reply || '')}')">
                    <i class="fa-solid fa-share-nodes"></i> ستوري
                </button>
                <button class="action-btn delete" onclick="deleteCloudMessage('${msg.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `).join('');
};

window.toggleReply = function(id) {
    const form = document.getElementById(`reply-form-${id}`);
    if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
};

window.submitReply = function(id) {
    const input = document.getElementById(`reply-input-${id}`);
    const text = input.value.trim();
    if (text) {
        updateCloudReply(id, text);
    }
};

window.openStoryModal = function(text, img, reply) {
    if (!currentUser) return;
    document.getElementById('story-user-name').innerText = currentUser.name;
    document.getElementById('story-user-handle').innerText = currentUser.handle;
    document.getElementById('story-user-avatar').src = currentUser.avatar;
    document.getElementById('story-text-content').innerText = text;

    const replyEl = document.getElementById('story-reply-content');
    if (reply && reply !== 'null' && reply !== '') {
        replyEl.innerText = `💬 ردك: ${reply}`;
        replyEl.style.display = 'block';
    } else replyEl.style.display = 'none';

    document.getElementById('story-modal').classList.add('active');
};

window.closeStoryModal = function() {
    document.getElementById('story-modal').classList.remove('active');
};

window.downloadStoryImage = function() {
    const storyElement = document.getElementById('story-card-element');
    showToast("جاري تحضير الصورة...");
    html2canvas(storyElement, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'sarahne-glass-story.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast("تم تنزيل الصورة بنجاح! 📸");
        closeStoryModal();
    });
};

window.openEditModal = function() {
    if (!currentUser) return;
    document.getElementById('edit-name-input').value = currentUser.name;
    document.getElementById('edit-handle-input').value = currentUser.handle;
    document.getElementById('edit-bio-input').value = currentUser.bio;
    tempAvatarBase64 = currentUser.avatar;
    document.getElementById('edit-preview-avatar').src = currentUser.avatar;
    document.getElementById('edit-modal').classList.add('active');
};

window.closeEditModal = function() {
    document.getElementById('edit-modal').classList.remove('active');
};

window.handleAvatarUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempAvatarBase64 = e.target.result;
            document.getElementById('edit-preview-avatar').src = tempAvatarBase64;
            showToast("تم رفع وتجهيز صورة البروفايل!");
        };
        reader.readAsDataURL(file);
    }
};

window.handleImageUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageBase64 = e.target.result;
            const preview = document.getElementById('image-preview');
            preview.src = uploadedImageBase64;
            preview.style.display = 'block';
            showToast("تم إرفاق الصورة مع الرسالة!");
        };
        reader.readAsDataURL(file);
    }
};

window.switchTab = function(viewName, tabEl) {
    document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (viewName === 'inbox') {
        document.getElementById('view-inbox').classList.add('active');
        fetchCloudMessages();
    } else if (viewName === 'search') {
        document.getElementById('view-search').classList.add('active');
        fetchAllUsers();
    } else if (viewName === 'send') {
        document.getElementById('view-send').classList.add('active');
    }

    if (tabEl) tabEl.classList.add('active');
};

window.copyShareLink = function() {
    navigator.clipboard.writeText(window.location.href);
    showToast("تم نسخ رابط صراحة الخاص بك! 📋");
};

window.showToast = function(text) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-text').innerText = text;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
