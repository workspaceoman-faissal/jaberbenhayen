// ==========================================
// ملف إدارة العمليات والاتصال السحابي - منصة الانتخابات المدرسية
// سلطنة عمان - وزارة التربية والتعليم
// مدرسة جابر بن حيان للتعليم الأساسي (الصف التاسع - أ. فيصل العريبي)
// ==========================================

// رمز دخول لجنة الإشراف (المعلم) - يمكن تغييره من هنا فقط
// ملاحظة: هذا تحقق بسيط لمنع الدخول العرضي للوحة التحكم، وليس حماية أمنية قوية،
// لأن الصفحة تعمل بالكامل من المتصفح بدون خادم مصادقة حقيقي.
const TEACHER_ACCESS_CODE = "9F2026";

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
        return null;
    }
}

// دالة الحفظ والتحديث المباشر والفوري على GitHub عبر الدالة الخلفية الآمنة في Vercel
async function saveVotingDataToGitHub(newData) {
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

/**
 * تسجيل صوت الطالب بأمان قدر الإمكان.
 * بما أن الحفظ يعتمد على كتابة كامل الملف على GitHub، فإن تصويتين متزامنين تماماً
 * قد يتسبب أحدهما بالكتابة فوق الآخر. لتقليل هذا الاحتمال، نقوم بإعادة جلب أحدث
 * نسخة من البيانات مباشرة قبل الحفظ، ثم نطبّق تغييرات هذا الطالب فوقها، مع محاولة
 * واحدة إضافية في حال تعارض الحفظ.
 *
 * choices: كائن { اسم اللجنة: اسم الطالب المختار }
 * إرجاع: { success: boolean, data: الكائن المحدث في حال النجاح }
 */
async function submitBallot(voterName, voterClass, committees, choices) {
    const applyVote = (freshData) => {
        if (!freshData.votes) freshData.votes = {};
        if (!freshData.voters) freshData.voters = [];
        if (!freshData.userChoices) freshData.userChoices = {};
        if (!freshData.voterClasses) freshData.voterClasses = {};

        // خصم الصوت القديم لهذا الطالب إن وُجد (حالة التعديل)
        const previousChoices = freshData.userChoices[voterName];
        if (previousChoices) {
            committees.forEach((committee) => {
                const oldChosen = previousChoices[committee];
                if (oldChosen && freshData.votes[committee] && freshData.votes[committee][oldChosen] > 0) {
                    freshData.votes[committee][oldChosen] -= 1;
                }
            });
        }

        // تسجيل الاختيارات الجديدة
        freshData.userChoices[voterName] = {};
        committees.forEach((committee) => {
            const chosen = choices[committee];
            if (!chosen) return;
            if (!freshData.votes[committee]) freshData.votes[committee] = {};
            freshData.votes[committee][chosen] = (freshData.votes[committee][chosen] || 0) + 1;
            freshData.userChoices[voterName][committee] = chosen;
        });

        if (!freshData.voters.includes(voterName)) {
            freshData.voters.push(voterName);
        }
        freshData.voterClasses[voterName] = voterClass;

        return freshData;
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        const latest = await fetchVotingData();
        if (!latest || !latest.data) {
            return { success: false, reason: 'تعذر تحميل أحدث نسخة من البيانات قبل الحفظ.' };
        }
        const updated = applyVote(latest.data);
        const saved = await saveVotingDataToGitHub(updated);
        if (saved) {
            return { success: true, data: updated };
        }
        // في حال الفشل، أعد المحاولة مرة واحدة فقط بعد إعادة الجلب
    }
    return { success: false, reason: 'تعذر حفظ التصويت بعد عدة محاولات، يرجى المحاولة مرة أخرى بعد قليل.' };
}

/**
 * تحديث حالة فتح/إغلاق التصويت والموعد النهائي (تُستخدم من لوحة المعلم)
 */
async function updateVotingStatus(currentData, { votingOpen, votingDeadline } = {}) {
    const latest = await fetchVotingData();
    const base = (latest && latest.data) ? latest.data : currentData;
    if (typeof votingOpen === 'boolean') base.votingOpen = votingOpen;
    if (votingDeadline !== undefined) base.votingDeadline = votingDeadline;
    const saved = await saveVotingDataToGitHub(base);
    return { success: saved, data: base };
}

/**
 * تصدير النتائج الحالية كملف CSV قابل للتحميل
 */
function exportResultsCSV(data) {
    if (!data || !data.committees) return;

    let allStudents = [];
    if (data.classes) {
        Object.values(data.classes).forEach((list) => {
            allStudents = allStudents.concat(list);
        });
    }

    const rows = [['اللجنة', 'المرشح', 'عدد الأصوات']];
    data.committees.forEach((committee) => {
        const votesForCommittee = (data.votes && data.votes[committee]) || {};
        allStudents.forEach((student) => {
            const count = votesForCommittee[student] || 0;
            if (count > 0) {
                rows.push([committee, student, String(count)]);
            }
        });
    });

    const csvContent = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نتائج_الانتخابات_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
