// 年収プレビュー
function updateIncomePreview() {
    const val = parseInt(document.getElementById('income').value, 10);
    const preview = document.getElementById('incomePreview');
    if (!val || val <= 0) {
        preview.textContent = '';
        return;
    }
    preview.textContent = `→ ${val.toLocaleString()} 万円（${(val * 10000).toLocaleString()} 円）`;
}

// 年齢プレビュー
function updateAgePreview() {
    const val = parseInt(document.getElementById('age').value, 10);
    const preview = document.getElementById('agePreview');
    if (!val || val < 18 || val > 75) {
        preview.textContent = '';
        return;
    }
    const note = val >= 40 ? '（40歳以上のため介護保険料が加算されます）' : '';
    preview.textContent = `→ ${val} 歳 ${note}`;
}

// プライバシーポリシー モーダル
function openPrivacyModal() {
    document.getElementById('privacyModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closePrivacyModal() {
    document.getElementById('privacyModal').classList.remove('open');
    document.body.style.overflow = '';
}

// 数値フォーマット（円）
function fmt(n) {
    return Math.round(n).toLocaleString() + ' 円';
}

// ===== 計算ロジック =====

// 給与所得控除（2020年以降）
function calcEmploymentDeduction(incomeYen) {
    if (incomeYen <= 1625000)  return 550000;
    if (incomeYen <= 1800000)  return Math.floor(incomeYen * 0.4 - 100000);
    if (incomeYen <= 3600000)  return Math.floor(incomeYen * 0.3 + 80000);
    if (incomeYen <= 6600000)  return Math.floor(incomeYen * 0.2 + 440000);
    if (incomeYen <= 8500000)  return Math.floor(incomeYen * 0.1 + 1100000);
    return 1950000;
}

// 所得税（超過累進課税 + 復興特別所得税2.1%）
function calcIncomeTax(taxableIncome) {
    let tax = 0;
    if      (taxableIncome <= 1950000)  tax = taxableIncome * 0.05;
    else if (taxableIncome <= 3300000)  tax = taxableIncome * 0.10 - 97500;
    else if (taxableIncome <= 6950000)  tax = taxableIncome * 0.20 - 427500;
    else if (taxableIncome <= 9000000)  tax = taxableIncome * 0.23 - 636000;
    else if (taxableIncome <= 18000000) tax = taxableIncome * 0.33 - 1536000;
    else if (taxableIncome <= 40000000) tax = taxableIncome * 0.40 - 2796000;
    else                                tax = taxableIncome * 0.45 - 4796000;
    return Math.round(Math.max(0, tax) * 1.021);
}

function calculate(incomeMan, employmentType, familyType, hasHousingLoan, hasLifeInsurance, age) {
    const incomeYen = incomeMan * 10000;

    // ── 1. 給与所得（収入 − 給与所得控除） ──
    let employmentDeduction;
    if (employmentType === 'self') {
        // 自営業：青色申告特別控除65万を簡略的に適用
        employmentDeduction = 650000;
    } else {
        employmentDeduction = calcEmploymentDeduction(incomeYen);
    }
    const grossIncome = Math.max(0, incomeYen - employmentDeduction);

    // ── 2. 社会保険料 ──
    let healthInsurance, pension, employmentInsurance, nursingInsurance;

    if (employmentType === 'self') {
        // 国民健康保険（所得割を簡略計算、上限92万）
        healthInsurance     = Math.round(Math.min(grossIncome * 0.095, 920000));
        // 国民年金（2024年度：月額16,980円 × 12）
        pension             = 203760;
        employmentInsurance = 0;
        // 介護保険料（40歳以上）：国保の介護分として所得の約1.8%で簡略計算
        nursingInsurance    = age >= 40 ? Math.round(Math.min(grossIncome * 0.018, 170000)) : 0;
    } else {
        // 会社員・公務員（協会けんぽ全国平均ベース・労使折半の本人負担）
        const standardMonthly   = Math.min(incomeYen / 12, 650000);
        healthInsurance         = Math.round(standardMonthly * 0.05   * 12); // 健康保険 5.0%
        pension                 = Math.round(Math.min(standardMonthly, 635000) * 0.0915 * 12); // 厚生年金 9.15%
        employmentInsurance     = Math.round(incomeYen * 0.006); // 雇用保険 0.6%
        // 介護保険料（40歳以上）：標準報酬月額 × 1.82% の労使折半（本人0.91%）
        nursingInsurance        = age >= 40
            ? Math.round(Math.min(standardMonthly, 650000) * 0.0091 * 12)
            : 0;
    }
    const totalSocialInsurance = healthInsurance + pension + employmentInsurance + nursingInsurance;

    // ── 3. 所得控除（所得税用） ──
    let deductions = 480000; // 基礎控除
    deductions += totalSocialInsurance; // 社会保険料控除
    if (familyType === 'spouse') deductions += 380000; // 配偶者控除
    if (familyType === 'child1') deductions += 380000; // 扶養控除（一般）
    if (familyType === 'child2') deductions += 760000; // 扶養控除 × 2
    if (hasLifeInsurance)        deductions += 40000;  // 生命保険料控除

    const taxableIncome = Math.max(0, grossIncome - deductions);

    // ── 4. 所得税（住宅ローン控除は税額控除） ──
    let incomeTax = calcIncomeTax(taxableIncome);
    if (hasHousingLoan) incomeTax = Math.max(0, incomeTax - 200000);

    // ── 5. 住民税（所得割10% + 均等割5,000円） ──
    // 住民税の基礎控除43万・配偶者控除33万で所得税と別計算
    let residentialDeductions = 430000;
    residentialDeductions += totalSocialInsurance;
    if (familyType === 'spouse') residentialDeductions += 330000;
    if (familyType === 'child1') residentialDeductions += 330000;
    if (familyType === 'child2') residentialDeductions += 660000;
    if (hasLifeInsurance)        residentialDeductions += 28000;

    const residentialTaxableIncome = Math.max(0, grossIncome - residentialDeductions);
    let residentialTax = Math.round(residentialTaxableIncome * 0.10) + 5000;
    if (hasHousingLoan) residentialTax = Math.max(0, residentialTax - 136500);

    // ── 6. 手取り ──
    const totalDeductions  = incomeTax + residentialTax + totalSocialInsurance;
    const takeHomeAnnual   = incomeYen - totalDeductions;
    const takeHomeMonthly  = Math.round(takeHomeAnnual / 12);

    return {
        takeHomeAnnual,
        takeHomeMonthly,
        incomeTax,
        residentialTax,
        healthInsurance,
        pension,
        employmentInsurance,
        nursingInsurance,
        totalDeductions,
        isSelf: employmentType === 'self',
        hasNursing: age >= 40,
    };
}

// ===== イベント =====

document.addEventListener('DOMContentLoaded', function () {
    // オーバーレイクリックでモーダルを閉じる
    document.getElementById('privacyModal').addEventListener('click', function (e) {
        if (e.target === this) closePrivacyModal();
    });

    // Escキーでモーダルを閉じる
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePrivacyModal();
    });

    // 計算フォーム送信
    document.getElementById('calcForm').addEventListener('submit', function (e) {
        e.preventDefault();

        const incomeMan    = parseFloat(document.getElementById('income').value);
        const age          = parseInt(document.getElementById('age').value, 10);
        const employment   = document.querySelector('input[name="employment"]:checked').value;
        const family       = document.querySelector('input[name="family"]:checked').value;
        const hasHousing   = document.querySelector('input[name="housing"]:checked').value === 'yes';
        const hasInsurance = document.querySelector('input[name="insurance"]:checked').value === 'yes';

        if (!incomeMan || incomeMan <= 0 || !age || age < 18 || age > 75) return;

        const r = calculate(incomeMan, employment, family, hasHousing, hasInsurance, age);

        document.getElementById('takeHomeAnnual').textContent  = Math.round(r.takeHomeAnnual).toLocaleString();
        document.getElementById('takeHomeMonthly').textContent = Math.round(r.takeHomeMonthly).toLocaleString();
        document.getElementById('incomeTax').textContent       = fmt(r.incomeTax);
        document.getElementById('residentialTax').textContent  = fmt(r.residentialTax);
        document.getElementById('healthInsurance').textContent = fmt(r.healthInsurance);
        document.getElementById('pension').textContent         = fmt(r.pension);
        document.getElementById('totalDeductions').textContent = fmt(r.totalDeductions);

        // 介護保険料（40歳以上のみ表示）
        const nursingRow = document.getElementById('nursingInsuranceRow');
        if (r.hasNursing) {
            document.getElementById('nursingInsurance').textContent = fmt(r.nursingInsurance);
            nursingRow.style.display = '';
        } else {
            nursingRow.style.display = 'none';
        }

        // 自営業は雇用保険なし
        document.getElementById('employmentInsurance').textContent =
            r.isSelf ? 'なし' : fmt(r.employmentInsurance);

        const container = document.getElementById('resultContainer');
        container.classList.remove('hidden');
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
