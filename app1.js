// ==========================================
// ملف إدارة العمليات والاتصال السحابي - منصة الانتخابات المدرسية
// سلطنة عمان - وزارة التربية والتعليم
// مدرسة جابر بن حيان للتعليم الأساسي (الصف التاسع - أ. فيصل العريبي)
// ==========================================

// دالة جلب بيانات الانتخابات والمرشحين من السيرفر بشكل مباشر وآمن
async function fetchVotingData() {
    try {
        const response = await fetch('./data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('فشل في قراءة ملف البيانات (data.json)');
        
        const data = await response.json();
        // لضمان التوافق مع الهيكل البرمجي للصفحات
        return {
            data: data,
            sha: null // غير مطلوب مع الدالة السحابية الآمنة
        };
    } catch (error) {
        console.error("خطأ في الاتصال بقاعدة البيانات:", error);
        alert("تعذر تحميل بيانات المنصة، يجدر التأكد من وجود ملف data.json في المستودع.");
        return null;
    }
}

// دالة الحفظ والتحديث المباشر والفوري على GitHub عبر الدالة الخلفية الآمنة في Vercel
async function saveVotingDataToGitHub(newData, shaIgnored = null) {
    try {
        const response = await fetch('/api/update', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ newData })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'فشل التحديث السحابي عبر الخادم');
        }

        const result = await response.json();
        return result.success === true;
    } catch (error) {
        console.error("خطأ في عملية الحفظ السحابي:", error);
        return false;
    }
}
