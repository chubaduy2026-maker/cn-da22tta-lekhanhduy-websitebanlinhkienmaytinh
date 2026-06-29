class NeedResolver {
  /**
   * Resolves the user use case/need from text.
   * @param {string} text - Raw query message
   * @returns {string|null} Use case name or null
   */
  resolveNeed(text = '') {
    if (!text || typeof text !== 'string') return null;

    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (/(gaming|game|choi game|fps|moba|rpg|chien game)/.test(normalized)) return 'gaming';
    if (/(do hoa|thiet ke|design|graphic|render|3d|photoshop|premiere|illustrator|cad)/.test(normalized)) return 'design';
    if (/(lap trinh|code|programming|dev|developer|it|viet code)/.test(normalized)) return 'programming';
    if (/(van phong|office|word|excel|presentation|cong viec|soan thao|nhap lieu)/.test(normalized)) return 'office';
    if (/(sinh vien|hoc tap|hoc sinh|student|di hoc|bai tap|nha truong)/.test(normalized)) return 'student';

    return null;
  }
}

module.exports = new NeedResolver();
