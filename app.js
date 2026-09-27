// ==========================================
// 1. الإعدادات المتغيرات العامة
// ==========================================
const GITHUB_CONFIG = {
    owner: 'YOUR_GITHUB_USERNAME', // استبدل باسم المستخدم في GitHub
    repo: 'school-elections',      // استبدل باسم مستودع البيانات
    path: 'data/votes.json',       // مسار ملف البيانات
    token: 'YOUR_PERSONAL_ACCESS_TOKEN' // توكن الصلاحيات
};

// البيانات الأولية للنظام
let votingData = {
    settings: {
        schoolName: "مدرسة جابر بن حيان للتعليم الأساسي",
        supervisor: "أ. فيصل العريبي",
        isVotingActive: true
    },
    students: [], // قائمة الطلاب المسجلين
    candidates: [], // قائمة المرشحين
    votes: [] // سجل أصوات الاقتراع
};

let currentFileSHA = ""; // لحفظ SHA الخاص بـ GitHub Commit

// ==========================================
// 2. دوال الاتصال بالسحابة (GitHub API)
// ==========================================

// جلب أحدث بيانات التصويت من GitHub
async function fetchVotingData() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentFileSHA = data.sha;
            // فك التشفير من Base64 لدعم اللغة العربية بشكل صحيح
            const content = decodeURIComponent(escape(atob(data.content)));
            votingData = JSON.parse(content);
            return votingData;
        } else {
            console.warn("لم يتم العثور على ملف البيانات، يتم استخدام البيانات المحلية.");
            return votingData;
        }
    } catch (error) {
        console.error("خطأ في جلب البيانات من GitHub:", error);
        return votingData;
    }
}

// حفظ بيانات التصويت إلى GitHub
async function saveVotingDataToGitHub(commitMessage = "تحديث بيانات الانتخابات") {
    try {
        // إعادة جلب الـ SHA الأحدث لتجنب تعارض التحديثات (409 Conflict)
        await fetchVotingData();

        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const jsonString = JSON.stringify(votingData, null, 2);
        
        // تشفير النص إلى Base64 يدعم UTF-8
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        const body = {
            message: commitMessage,
            content: encodedContent,
            sha: currentFileSHA
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const resData = await response.json();
            currentFileSHA = resData.content.sha;
            return true;
        } else {
            throw new Error(`فشل الحفظ: ${response.statusText}`);
        }
    } catch (error) {
        console.error("خطأ أثناء الحفظ على GitHub:", error);
        alert("حدث خطأ أثناء حفظ البيانات سحابياً. يرجى التحقق من الاتصال بالإنترنت.");
        return false;
    }
}

// ==========================================
// 3. دوال منطق الاقتراع والتحقق
// ==========================================

// إرسال صوت الطالب مع التحقق من عدم التكرار والمنع المزدوج
async function submitBallot(studentCivilId, selectedCandidateIds) {
    // 1. مزامنة البيانات أولاً
    await fetchVotingData();

    // 2. التحقق من حالة التصويت
    if (!votingData.settings.isVotingActive) {
        alert("عذراً، التصويت مغلق حالياً.");
        return false;
    }

    // 3. التحقق من وجود الطالب وعدم تصويطه سابقاً
    const existingVote = votingData.votes.find(v => v.studentCivilId === studentCivilId);
    if (existingVote) {
        alert("عذراً، هذا الرقم المدني قد قام بالتصويت مسبقاً!");
        return false;
    }

    // 4. تسجيل الصوت
    const newVote = {
        studentCivilId: studentCivilId,
        selectedCandidates: selectedCandidateIds, // مصفوفة المعرفات المختارة
        timestamp: new Date().toISOString()
    };

    votingData.votes.push(newVote);

    // 5. الحفظ السحابي
    const success = await saveVotingDataToGitHub(`تسجيل صوت جديد للرقم المدني: ${studentCivilId}`);
    if (success) {
        alert("تم تسجيل صوتك بنجاح. شكراً لمشاركتك!");
        return true;
    }
    return false;
}

// ==========================================
// 4. دوال الفرز واستخراج التقارير (لوحة المعلم)
// ==========================================

// استخراج نتائج شعبة معينة مع تجميع الأصوات حسب userChoices
function getResultsByClassSection(classSection) {
    // تصفية الطلاب التابعين للشعبة
    const sectionStudents = votingData.students.filter(s => s.classSection === classSection);
    const sectionStudentIds = sectionStudents.map(s => s.civilId);

    // تصفية الأصوات الخاصة بطلاب هذه الشعبة فقط
    const sectionVotes = votingData.votes.filter(v => sectionStudentIds.includes(v.studentCivilId));

    // حساب الأصوات لكل مرشح
    const candidateScores = {};
    votingData.candidates.forEach(c => {
        if (c.classSection === classSection) {
            candidateScores[c.id] = {
                candidate: c,
                votesCount: 0
            };
        }
    });

    sectionVotes.forEach(vote => {
        vote.selectedCandidates.forEach(candId => {
            if (candidateScores[candId]) {
                candidateScores[candId].votesCount += 1;
            }
        });
    });

    return Object.values(candidateScores).sort((a, b) => b.votesCount - a.votesCount);
}

// تصدير النتائج إلى ملف CSV
function exportResultsToCSV(classSection) {
    const results = getResultsByClassSection(classSection);
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM لدعم اللغة العربية في Excel
    csvContent += "اسم المرشح,اللجنة/المنصب,الشعبة,عدد الأصوات\n";

    results.forEach(row => {
        csvContent += `"${row.candidate.name}","${row.candidate.position}","${row.candidate.classSection}",${row.votesCount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `نتائج_انتخابات_الشعبة_${classSection}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
