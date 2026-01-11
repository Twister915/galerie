use std::collections::HashMap;

pub type Translations = HashMap<String, String>;
pub type AllTranslations = HashMap<String, Translations>;

/// Get translations for all supported languages.
pub fn get_all_translations() -> AllTranslations {
    let mut all = HashMap::new();
    all.insert("en".to_string(), translations_en());
    all.insert("zh_CN".to_string(), translations_zh_cn());
    all
}

fn translations_en() -> Translations {
    [
        // Navigation
        ("nav.previous", "Previous"),
        ("nav.next", "Next"),
        ("nav.index", "Index"),
        ("nav.close", "Close"),
        // Sections
        ("section.albums", "Albums"),
        ("section.photo", "Photo"),
        ("section.date", "Date"),
        ("section.camera", "Camera"),
        ("section.exposure", "Exposure"),
        ("section.location", "Location"),
        ("section.copyright", "Copyright"),
        // Fields
        ("field.name", "Name"),
        ("field.taken", "Taken"),
        ("field.camera", "Camera"),
        ("field.lens", "Lens"),
        ("field.aperture", "Aperture"),
        ("field.shutter", "Shutter"),
        ("field.iso", "ISO"),
        ("field.focal_length", "Focal Length"),
        ("field.place", "Place"),
        ("field.country", "Country"),
        ("field.coordinates", "Coordinates"),
        // Actions
        ("action.download", "Download Original"),
        ("action.toggle_info", "Toggle info"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect()
}

fn translations_zh_cn() -> Translations {
    [
        // Navigation
        ("nav.previous", "上一张"),
        ("nav.next", "下一张"),
        ("nav.index", "索引"),
        ("nav.close", "关闭"),
        // Sections
        ("section.albums", "相册"),
        ("section.photo", "照片"),
        ("section.date", "日期"),
        ("section.camera", "相机"),
        ("section.exposure", "曝光"),
        ("section.location", "位置"),
        ("section.copyright", "版权"),
        // Fields
        ("field.name", "名称"),
        ("field.taken", "拍摄时间"),
        ("field.camera", "相机"),
        ("field.lens", "镜头"),
        ("field.aperture", "光圈"),
        ("field.shutter", "快门"),
        ("field.iso", "ISO"),
        ("field.focal_length", "焦距"),
        ("field.place", "地点"),
        ("field.country", "国家"),
        ("field.coordinates", "坐标"),
        // Actions
        ("action.download", "下载原图"),
        ("action.toggle_info", "切换信息"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect()
}
