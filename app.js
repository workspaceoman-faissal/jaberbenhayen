// إعدادات مستودع GitHub الخاص بك
const GITHUB_USER = "YOUR_GITHUB_USERNAME"; // ضع اسم مستخدم جيت هب هنا
const REPO_NAME = "jabir-voting-platform";   // اسم المستودع
const BRANCH = "main";                      // فرع المستودع الرئيسي
const GITHUB_TOKEN = "YOUR_PERSONAL_ACCESS_TOKEN"; // رمز الوصول الشخصي من جيت هب (صلاحية Contents: Write)

const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/data.json`;

// دالة جلب البيانات المباشرة من GitHub
async function fetchVotingData() {
    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('فشل الاتصال بقاعدة البيانات السحابية');
        const fileData = await response.json();
        const decodedContent = decodeURIComponent(escape(atob(fileData.content)));
        return {
            sha: fileData.sha,
            data: JSON.parse(decodedContent)
        };
    } catch (error) {
        console.error("خطأ في الاتصال:", error);
        alert("حدث خطأ أثناء تحميل البيانات من السحابة.");
        return null;
    }
}

// دالة الحفظ التلقائي المباشر لملف JSON على GitHub
async function saveVotingDataToGitHub(newData, sha) {
    try {
        const jsonString = JSON.stringify(newData, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        const response = await fetch(GITHUB_API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: "تحديث تلقائي لبيانات الانتخابات المدرسية - سلطنة عمان",
                content: encodedContent,
                sha: sha,
                branch: BRANCH
            })
        });

        if (!response.ok) throw new Error('فشل الحفظ المباشر على جيت هب');
        return true;
    } catch (error) {
        console.error("خطأ في الحفظ:", error);
        return false;
    }
}
