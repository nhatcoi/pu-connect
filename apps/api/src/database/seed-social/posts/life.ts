import type { SeedPost } from '../types'

// Đời sống: ăn uống, du lịch, thể thao, nhà trọ
export const LIFE_POSTS: SeedPost[] = [
  {
    key: 'life-linh-bun-cha',
    by: 'khanhlinh_eat',
    daysAgo: 3,
    at: '12:40',
    title: 'Top 5 quán ăn trưa dưới 40k quanh Phenikaa (update tháng 10)',
    content: `Đi ăn thử cả tháng mới dám viết, giá chuẩn sinh viên:

**1. Bún chả ngõ cổng phụ – 35k**
Chả nướng than thơm, nước chấm vừa, rau sống sạch. Đi sau 12h15 là hết chả miếng.

**2. Cơm rang dưa bò – 35k**
Phần to, cơm tơi. Bảo cô ít dầu là cô làm liền.

**3. Bánh mì chảo – 30k**
Pate tự làm, có trứng ốp la. Sáng đi học muộn ăn cái này là chân ái.

**4. Phở gà trộn – 40k**
Hơi xa (đi xe 5 phút) nhưng đáng. Nước dùng kèm thanh, không bị ngọt mì chính.

**5. Cơm văn phòng tự chọn – 30–40k**
Chọn 1 mặn 2 rau, có canh miễn phí. Ăn healthy mà rẻ.

Ai biết quán nào ngon nữa tag mình nha, mình đi thử rồi update 🍜`,
    tags: ['AnUong', 'ReviewQuan', 'GiaSinhVien'],
    community: 'phenikaa',
    images: [999, 488],
    likes: 20,
    saves: 17,
    comments: [
      { by: 'giabao_runs', text: 'Số 1 chuẩn, mỗi tội xếp hàng hơi lâu 😂', after: 20, likes: 4 },
      { by: 'vannam2k8', text: 'Chị ơi cơm rang dưa bò ở ngõ nào ạ, em mới lên chưa biết đường 🥲', after: 35, replies: [{ by: 'khanhlinh_eat', text: 'Ngõ đối diện cổng chính, đi vào tầm 50m bên tay trái, biển xanh to lắm em', after: 10 }] },
      { by: 'thuydung05', text: 'bài review có tâm nhất năm, mình xin lưu', after: 60 },
      { by: 'tiendat_ngo', text: 'thiếu quán bún đậu cuối ngõ nhé, 30k mà mắm tôm đỉnh', after: 90, likes: 6 }
    ]
  },
  {
    key: 'life-thu-ha-giang',
    by: 'anhthu_phan',
    daysAgo: 9,
    at: '21:20',
    title: 'Hà Giang mùa tam giác mạch: 3 ngày 2 đêm hết 2,8 triệu',
    content: `Vừa về từ Hà Giang, mùa này đẹp không tả nổi 🌸

**Lịch trình:** Hà Nội → TP Hà Giang (xe giường nằm đêm) → Quản Bạ → Yên Minh → Đồng Văn → Mã Pí Lèng → Mèo Vạc → về.

**Chi phí (1 người, đi 4 người):**
- Xe khách khứ hồi: 500k
- Thuê xe máy 3 ngày: 450k
- Homestay 2 đêm: 400k
- Ăn uống: 900k
- Xăng + vé tham quan + linh tinh: 550k

**Lưu ý:**
- Không tự lái nếu chưa quen đèo dốc, thuê xe kèm lái (easy rider) an toàn hơn nhiều.
- Mang áo ấm, sáng sớm trên Đồng Văn lạnh lắm.
- Đi ngày thường, cuối tuần đông nghẹt.

Album đầy đủ để ở dưới, ảnh chụp bằng máy film nên màu hơi ám vàng nha 📷`,
    tags: ['DuLich', 'HaGiang', 'TamGiacMach'],
    images: [287, 916, 1018, 484],
    likes: 20,
    saves: 14,
    comments: [
      { by: 'khanhlinh_eat', text: 'Màu film đẹp quá trời, máy gì vậy Thư?', after: 15, replies: [{ by: 'anhthu_phan', text: 'Olympus mju II của bố mình đó 😆', after: 8 }] },
      { by: 'thao_ielts', text: 'Chi phí rẻ hơn mình nghĩ nhiều. Lưu lại cho chuyến cuối kỳ!', after: 50 },
      { by: 'giabao_runs', text: 'Đèo Mã Pí Lèng mà chạy bộ chắc đứt hơi 😂', after: 95 }
    ]
  },
  {
    key: 'life-bao-running',
    by: 'giabao_runs',
    daysAgo: 2,
    at: '06:15',
    content: `5h sáng, hồ Văn Quán, 7km, pace 5:40.

Tháng thứ 3 chạy đều mỗi sáng. Ngủ ngon hơn, ít cà phê hơn, học buổi sáng tỉnh hơn hẳn. Ai muốn chạy cùng thì Phenikaa Runners tập trung 5h15 thứ 3-5-7 ở cổng chính nhé, người mới chạy 3km cũng được 🏃`,
    tags: ['ChayBo', 'SucKhoe', 'PhenikaaRunners'],
    community: 'clb-hoat-dong',
    images: [314],
    likes: 15,
    comments: [
      { by: 'ngocanh_med', text: 'Ủng hộ! Nhớ khởi động kỹ cổ chân với đầu gối nha, mùa này sáng lạnh dễ chấn thương', after: 40, likes: 4 },
      { by: 'tiendat_ngo', text: '5h sáng là giờ mình đi ngủ', after: 120, likes: 10 },
      { by: 'thutrang_ly', text: 'Thứ 3 tới mình đi thử nha, chạy 2km thôi được không 🥲', after: 200, replies: [{ by: 'giabao_runs', text: 'Được luôn, có nhóm đi bộ nhanh nữa á', after: 15 }] }
    ]
  },
  {
    key: 'life-linh-cafe-study',
    by: 'khanhlinh_eat',
    daysAgo: 16,
    at: '16:50',
    title: 'Quán cà phê học bài: có ổ cắm, wifi khỏe, không bị đuổi khéo',
    content: `Tổng hợp cho mùa ôn thi, tiêu chí: ổ cắm nhiều, wifi ổn, ngồi lâu không bị nhìn 😂

☕ **Quán sân vườn sau ký túc** – yên tĩnh, nhiều cây, có phòng lạnh trên tầng 2. Đồ uống ~30k.
☕ **Quán tầng 3 view hồ** – đẹp, chill, nhưng cuối tuần hơi ồn.
☕ **Quán mở 24h trên Quang Trung** – cứu tinh mùa deadline, có góc học riêng.

Mẹo: gọi thêm 1 món sau 2–3 tiếng là chủ quán quý liền 😆`,
    tags: ['CaPhe', 'HocBai', 'OnThi'],
    images: [163, 192, 42],
    likes: 17,
    saves: 12,
    comments: [
      { by: 'thao_ielts', text: 'Quán sân vườn sau ký túc là chỗ mình ôn IELTS suốt kỳ trước, xác nhận yên tĩnh', after: 30 },
      { by: 'haiyen_ux', text: 'Quán view hồ chụp ảnh đẹp lắm, nhưng đúng là cuối tuần đông', after: 70 }
    ]
  },
  {
    key: 'life-room-find',
    by: 'vannam2k8',
    daysAgo: 28,
    at: '14:00',
    type: 'question',
    title: 'Tìm phòng trọ gần trường cho tân sinh viên: nên ở ghép hay ở một mình?',
    content: `Em K20, đang ở tạm nhà người quen, tháng sau phải ra ngoài ở. Budget khoảng 1,5–2 triệu/tháng cả điện nước.

Em nên ở ghép hay ở một mình ạ? Và khu nào gần trường mà an ninh tốt? Em cảm ơn anh chị nhiều 🙏`,
    tags: ['PhongTro', 'TanSinhVien', 'HoiDap'],
    community: 'tim-phong-tro',
    resolved: true,
    likes: 8,
    comments: [
      {
        by: 'thutrang_ly',
        solution: true,
        after: 45,
        likes: 6,
        text: `Budget 1,5–2tr thì ở ghép 2–3 người sẽ dư dả hơn nhiều em. Kinh nghiệm của chị:
- Khu Yên Nghĩa, Văn Phú đi bộ/xe đạp tới trường được, giá dễ chịu.
- Xem phòng **buổi tối** để biết có ồn, có ngập, có an toàn không.
- Hỏi rõ giá điện (giá dân hay 3,5–4k/số), tiền rác, tiền xe.
- Chụp ảnh hiện trạng phòng khi nhận, ghi rõ tiền cọc trong hợp đồng.`
      },
      { by: 'khanhlinh_eat', text: 'Ở ghép thì chọn người cùng giờ giấc sinh hoạt nhé em, quan trọng hơn cả giá phòng đó 😂', after: 90, likes: 5 },
      { by: 'vannam2k8', text: 'Em cảm ơn chị nhiều, tối nay em đi xem phòng luôn ạ!', after: 20 }
    ]
  },
  {
    key: 'life-thu-sunrise',
    by: 'anhthu_phan',
    daysAgo: 22,
    at: '05:50',
    content: `Dậy sớm leo lên sân thượng ký túc chỉ để chụp cái này. Không hối hận 🌅`,
    tags: ['Photography', 'BinhMinh'],
    images: [1067],
    likes: 18,
    comments: [
      { by: 'haiyen_ux', text: 'đẹp như wallpaper luôn á', after: 25, likes: 3 },
      { by: 'tiendat_ngo', text: 'tôi xem bình minh qua story người khác thôi', after: 180, likes: 7 }
    ]
  },
  {
    key: 'life-ngocanh-sleep',
    by: 'ngocanh_med',
    daysAgo: 12,
    at: '23:30',
    title: 'Sinh viên Y nói về giấc ngủ (nghe xong đi ngủ luôn nha)',
    content: `Mùa thi rồi, nhắc nhẹ mấy điều về ngủ mà tụi mình học trên lớp:

- **Thức trắng ôn thi làm giảm khả năng ghi nhớ**, vì não củng cố trí nhớ trong lúc ngủ. Học 8 tiếng mà không ngủ = học 4 tiếng còn nhớ.
- Ngủ trưa **15–20 phút** là đủ, dài quá dễ dậy mệt hơn.
- Cà phê sau 3h chiều vẫn còn tác dụng lúc 10h tối.
- Màn hình trước khi ngủ không chỉ là ánh sáng xanh, mà là nội dung làm não tỉnh (lướt video ngắn chính là thủ phạm 😅).

Nói vậy thôi chứ giờ mình cũng đang thức viết bài này. Đi ngủ đây, mọi người cũng ngủ đi nha 🌙`,
    tags: ['SucKhoe', 'GiacNgu', 'MuaThi'],
    course: 'FMS101',
    images: [691],
    likes: 19,
    saves: 9,
    comments: [
      { by: 'thuydung05', text: 'đọc lúc 1h sáng, cảm thấy bị nhắm vào 😭', after: 90, likes: 9 },
      { by: 'ducanh_ai', text: 'Câu "thức 8 tiếng = học 4 tiếng" nghe mà đau', after: 150 },
      { by: 'ngocanh_med', text: '@thuydung05 ngủ điiii', after: 5, likes: 4 }
    ]
  },
  {
    key: 'life-bao-gym-question',
    by: 'giabao_runs',
    daysAgo: 31,
    at: '19:30',
    title: 'Phòng gym gần trường giá sinh viên, mọi người tập ở đâu?',
    content: `Mình đang chạy bộ, muốn tập thêm tạ 3 buổi/tuần. Mọi người tập ở đâu gần trường, giá sinh viên khoảng bao nhiêu 1 tháng? Ưu tiên chỗ không quá đông giờ tối 🙏`,
    tags: ['Gym', 'TheThao'],
    images: [1058],
    likes: 7,
    comments: [
      { by: 'minhquan_gg', text: 'Chỗ mình tập ở Văn Phú 300k/tháng, giờ tối hơi đông nhưng máy đủ', after: 30 },
      { by: 'lehoangphuc', text: 'Trường có phòng tập ở nhà thể chất, sinh viên được giảm giá, hỏi phòng CTSV nhé', after: 60, likes: 4 }
    ]
  },
  {
    key: 'life-linh-hotpot',
    by: 'khanhlinh_eat',
    daysAgo: 0,
    at: '19:10',
    content: `Trời trở lạnh = mùa lẩu chính thức bắt đầu 🍲 Tối nay phòng mình làm lẩu Thái, 4 đứa hết 220k, no tới sáng mai.

Ai cần công thức nước lẩu chua cay "chuẩn sinh viên" thì comment, mình viết bài riêng!`,
    tags: ['AnUong', 'Lau', 'MuaDong'],
    images: [292],
    likes: 14,
    comments: [
      { by: 'thuydung05', text: 'comment để lấy công thức + xin 1 suất 🥺', after: 6, likes: 5 },
      { by: 'giabao_runs', text: 'cmt', after: 12 },
      { by: 'anhthu_phan', text: 'Cần công thức lắm luôn', after: 20 }
    ]
  },
  {
    key: 'life-thao-weekend',
    by: 'thao_ielts',
    daysAgo: 18,
    at: '10:20',
    content: `Cuối tuần không deadline, đi thư viện mượn 3 cuốn tiểu thuyết, pha ấm trà, đọc tới chiều. Có những ngày bình yên như vậy thôi là đủ 📚🍵`,
    tags: ['DocSach', 'CuoiTuan'],
    images: [367, 1073],
    likes: 13,
    comments: [
      { by: 'nguyenthuha', text: 'Cuộc sống tuyệt nhất là như vậy em ạ. Mấy cuốn gì thế?', after: 90, replies: [{ by: 'thao_ielts', text: 'Dạ Norwegian Wood, Klara and the Sun với một cuốn của Nguyễn Ngọc Tư ạ 😊', after: 30 }] }
    ]
  },
  {
    key: 'life-dat-cat',
    by: 'tiendat_ngo',
    daysAgo: 6,
    at: '22:40',
    content: `con mèo hàng xóm lại sang phòng mình ngủ. nó không phải mèo của mình nhưng mình đã mua hạt cho nó. mình nghĩ mình đã bị thao túng.`,
    tags: ['Meo'],
    images: [40],
    likes: 19,
    comments: [
      { by: 'thuydung05', text: 'bạn bị bắt cóc tình cảm rồi đó 😭', after: 10, likes: 8 },
      { by: 'khanhlinh_eat', text: 'mèo nó chọn bạn chứ không phải bạn chọn mèo', after: 30, likes: 6 },
      { by: 'ngocanh_med', text: 'đặt tên chưa', after: 50, replies: [{ by: 'tiendat_ngo', text: 'Sếp', after: 4, likes: 14 }] }
    ]
  }
]
