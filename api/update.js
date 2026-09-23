export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { newData } = req.body;
    const GITHUB_USER = process.env.GITHUB_USER;
    const REPO_NAME = process.env.REPO_NAME;
    const BRANCH = process.env.BRANCH || 'main';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // الـ Token مخفي في بيئة السيرفر الآمنة ولن يظهر للطلاب أبداً!

    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/data.json`;

    try {
        // 1. جلب الـ SHA الحالي للملف
        const getRes = await fetch(apiUrl, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        const fileData = await getRes.json();
        const sha = fileData.sha;

        // 2. تحديث الملف بالبيانات الجديدة
        const jsonString = JSON.stringify(newData, null, 2);
        const encodedContent = Buffer.from(jsonString).toString('base64');

        const updateRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: "تحديث تلقائي لأصوات الانتخابات - مدرسة جابر بن حيان",
                content: encodedContent,
                sha: sha,
                branch: BRANCH
            })
        });

        if (!updateRes.ok) throw new Error('فشل التحديث على GitHub');
        
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
