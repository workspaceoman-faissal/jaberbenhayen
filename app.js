// جلب البيانات مباشرة من ملف data.json العام
async function fetchVotingData() {
    try {
        const response = await fetch('data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('فشل تحميل البيانات');
        return await response.json();
    } catch (error) {
        console.error("خطأ:", error);
        return null;
    }
}

// إرسال البيانات للتحديث عبر الدالة السحابية الآمنة (بدون كشف أي Token)
async function saveVotingDataSecurely(newData) {
    try {
        const response = await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newData })
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error("خطأ في التحديث السحابي الآمن:", error);
        return false;
    }
}
