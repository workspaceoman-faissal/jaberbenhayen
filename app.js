// ==========================================
// 1. الإعدادات والمتغيرات العامة
// ==========================================
const GITHUB_CONFIG = {
    owner: 'YOUR_GITHUB_USERNAME', // استبدل باسم المستخدم في GitHub
    repo: 'school-elections',      // استبدل باسم مستودع البيانات
    path: 'data/votes.json',       // مسار ملف البيانات
    token: 'YOUR_PERSONAL_ACCESS_TOKEN' // توكن الصلاحيات
};

// البيانات الأولية للنظام
let userChoices = {
    settings: {
        schoolName: "مدرسة جابر بن حيان للتعليم الأساسي",
        supervisor: "أ. فيصل العريبي",
        isVotingActive: true
    },
    students: [], 
    candidates: [], 
    votes: [] 
};

let currentFileSHA = ""; 

// ==========================================
// 2. دوال الاتصال بالسحابة (GitHub API)
// ==========================================

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
            const content = decodeURIComponent(escape(atob(data.content)));
            userChoices = JSON.parse(content);
            return userChoices;
        } else {
            console.warn("لم يتم العثور على ملف البيانات، يتم استخدام البيانات المحلية.");
            return userChoices;
        }
    } catch (error) {
        console.error("خطأ في جلب البيانات من GitHub:", error);
        return userChoices;
    }
}

async function saveVotingDataToGitHub(commitMessage = "تحديث بيانات الانتخابات") {
    try {
        await fetchVotingData();

        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const jsonString = JSON.stringify(userChoices, null, 2);
        
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
        alert("حدث خطأ أثناء حفظ البيانات سحابياً.");
        return false;
    }
}

// ==========================================
// 3. دوال منطق الاقتراع والتحقق
// ==========================================

async function submitBallot(studentCivilId, selectedCandidateIds) {
    await fetchVotingData();

    if (!userChoices.settings.isVotingActive) {
        alert("عذراً، التصويت مغلق حالياً.");
        return false;
    }

    const existingVote = userChoices.votes.find(v => v.studentCivilId === studentCivilId);
    if (existingVote) {
        alert("عذراً، هذا الرقم المدني قد قام بالتصويت مسبقاً!");
        return false;
    }

    const newVote = {
        studentCivilId: studentCivilId,
        selectedCandidates: selectedCandidateIds,
        timestamp: new Date().toISOString()
    };

    userChoices.votes.push(newVote);

    const success = await saveVotingDataToGitHub(`تسجيل صوت جديد للرقم المدني: ${studentCivilId}`);
    if (success) {
        alert("تم تسجيل صوتك بنجاح. شكراً لمشاركتك!");
        return true;
    }
    return false;
}

// ==========================================
// 4. دوال الفرز واستخراج التقارير
// ==========================================

function getResultsByClassSection(classSection) {
    const sectionStudents = userChoices.students.filter(s => s.classSection === classSection);
    const sectionStudentIds = sectionStudents.map(s => s.civilId);

    const sectionVotes = userChoices.votes.filter(v => sectionStudentIds.includes(v.studentCivilId));

    const candidateScores = {};
    userChoices.candidates.forEach(c => {
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

function exportResultsToCSV(classSection) {
    const results = getResultsByClassSection(classSection);
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
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
