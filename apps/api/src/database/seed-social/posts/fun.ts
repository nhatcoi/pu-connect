import type { SeedPost } from '../types'

// Vui vẻ & đăng bừa: meme chữ, than thở, suy nghĩ vu vơ
export const FUN_POSTS: SeedPost[] = [
  {
    key: 'fun-dung-group-project',
    by: 'thuydung05',
    daysAgo: 4,
    at: '23:55',
    content: `Các giai đoạn của làm bài tập nhóm:

Tuần 1: "Nhóm mình chia việc rõ ràng nha mọi người 🥰"
Tuần 2: "Mọi người làm tới đâu rồi ạ?"
Tuần 3: *seen*
Tuần 4, 23h59 đêm trước hạn nộp: "ơ deadline là mai hả"

Ai cũng từng là một trong 4 người này 😭`,
    tags: ['BaiTapNhom', 'Meme'],
    community: 'phenikaa',
    likes: 20,
    comments: [
      { by: 'tiendat_ngo', text: 'tôi là người tuần 3', after: 5, likes: 13 },
      { by: 'khanhvy_mkt', text: 'mình là người làm hết vào tuần 4 lúc 23h59 😭', after: 12, likes: 9 },
      { by: 'phamduclong', text: 'Trợ giảng xin xác nhận: file nộp lúc 23:59:58 nhiều nhất 😂', after: 40, likes: 11 },
      { by: 'vannam2k8', text: 'em năm nhất mà đã trải qua đủ 4 giai đoạn rồi', after: 90, likes: 6 }
    ]
  },
  {
    key: 'fun-dat-wifi',
    by: 'tiendat_ngo',
    daysAgo: 7,
    at: '14:25',
    content: `wifi thư viện mạnh nhất vào đúng lúc mình không cần nó, và biến mất đúng lúc mình nộp bài online. có ai nghiên cứu hiện tượng này chưa`,
    tags: ['Wifi', 'ThuVien'],
    likes: 17,
    comments: [
      { by: 'minhquan_gg', text: 'định luật Murphy phiên bản sinh viên', after: 8, likes: 7 },
      { by: 'lehoangphuc', text: 'Đã chuyển feedback cho phòng IT trường 😅 tầng 3 thư viện đang lắp thêm access point', after: 120, likes: 9 }
    ]
  },
  {
    key: 'fun-dung-canteen',
    by: 'thuydung05',
    daysAgo: 13,
    at: '11:50',
    content: `11h50 căng tin: 300 người, 2 quầy cơm, 1 mục tiêu.

Hôm nay mình đã hiểu cảm giác của cá hồi bơi ngược dòng 🐟`,
    tags: ['CangTin', 'Meme'],
    images: [348],
    likes: 18,
    comments: [
      { by: 'khanhlinh_eat', text: 'Mẹo: đi lúc 11h20 hoặc sau 12h30, hoặc theo dõi bài review quán của mình 😌', after: 15, likes: 6 },
      { by: 'giabao_runs', text: 'thi chạy nước rút ra căng tin mỗi trưa, đó là lý do mình chạy bộ', after: 40, likes: 5 }
    ]
  },
  {
    key: 'fun-dat-shower-thought',
    by: 'tiendat_ngo',
    daysAgo: 11,
    at: '01:45',
    content: `nghĩ lúc 1h sáng: nếu điểm danh bằng nhận diện khuôn mặt thì những hôm mình mất ngủ, hệ thống có nhận ra mình không`,
    tags: ['NghiVuVo'],
    likes: 16,
    comments: [
      { by: 'ducanh_ai', text: 'Về kỹ thuật thì vẫn nhận ra nhé, quầng thâm không đủ để lừa model 😂', after: 25, likes: 8 },
      { by: 'thuydung05', text: 'hệ thống: "người lạ phát hiện"', after: 30, likes: 10 }
    ]
  },
  {
    key: 'fun-quan-valorant',
    by: 'minhquan_gg',
    daysAgo: 16,
    at: '23:20',
    title: 'CLB Esports tuyển thành viên đánh giải sinh viên Valorant',
    content: `CLB Esports Phenikaa đang tìm thêm 2 người cho đội Valorant đánh giải sinh viên khu vực Hà Nội:

- Rank Ascendant trở lên (hoặc Diamond nhưng giao tiếp tốt)
- Tập 3 buổi/tối/tuần, không ảnh hưởng lịch học
- Ưu tiên vai Controller hoặc Sentinel

Đánh vì vui là chính, có giải thì càng vui 😎 Comment rank + vai chơi chính nhé!`,
    tags: ['Esports', 'Valorant', 'CLB'],
    community: 'clb-hoat-dong',
    images: [96],
    likes: 12,
    comments: [
      { by: 'vannam2k8', text: 'Em Gold 3 main Sova, xin được dự bị cầm nước 🥹', after: 30, likes: 6 },
      { by: 'minhtuan_dev', text: 'Ascendant 1 Omen, ib nhé', after: 60 }
    ]
  },
  {
    key: 'fun-dung-k-drama',
    by: 'thuydung05',
    daysAgo: 20,
    at: '22:30',
    content: `Học tiếng Hàn 2 năm, kết quả: xem phim vẫn phải bật phụ đề nhưng giờ mình biết phụ đề dịch sai chỗ nào 🙂`,
    tags: ['TiengHan', 'Kdrama'],
    likes: 15,
    comments: [
      { by: 'thao_ielts', text: 'level cao nhất của học ngoại ngữ là cáu phụ đề 😂', after: 20, likes: 7 }
    ]
  },
  {
    key: 'fun-dat-rain',
    by: 'tiendat_ngo',
    daysAgo: 25,
    at: '17:30',
    content: `mưa to, quên áo mưa, đứng trú ở nhà xe 40 phút. trong 40 phút đó mình đã nghĩ lại toàn bộ cuộc đời.`,
    tags: ['Mua'],
    images: [797],
    likes: 14,
    comments: [
      { by: 'anhthu_phan', text: 'Ảnh đẹp mà caption đau lòng ghê', after: 25 },
      { by: 'thuydung05', text: 'kết luận sau 40 phút là gì', after: 30, replies: [{ by: 'tiendat_ngo', text: 'mua áo mưa để cốp xe', after: 3, likes: 9 }] }
    ]
  },
  {
    key: 'fun-dung-deadline-poll',
    by: 'thuydung05',
    daysAgo: 9,
    at: '20:15',
    content: `Khảo sát nghiêm túc cho mùa giữa kỳ 📊`,
    tags: ['KhaoSat', 'MuaThi'],
    poll: {
      question: 'Bạn làm bài tập lớn vào lúc nào?',
      options: ['Ngay khi thầy cô giao', 'Từ từ mỗi ngày một ít', 'Tuần cuối', 'Đêm cuối'],
      votes: [1, 3, 6, 9],
      closesInDays: 3
    },
    likes: 16,
    comments: [
      { by: 'phamduclong', text: 'Người vote "ngay khi giao" xin hãy lộ diện để chúng tôi học hỏi', after: 40, likes: 10 },
      { by: 'thao_ielts', text: '...là mình 🙋‍♀️', after: 50, likes: 6 }
    ]
  },
  {
    key: 'fun-nam-first-month',
    by: 'vannam2k8',
    daysAgo: 2,
    at: '22:20',
    content: `Tổng kết tháng đầu làm sinh viên:
- Đi nhầm phòng học: 3 lần
- Gọi thầy là "anh": 1 lần (thầy trẻ quá 😭)
- Ăn mì tôm: không đếm nổi
- Hiểu đệ quy: 1 lần (cảm ơn anh Long)

Nhìn chung vẫn thấy vui, đại học xịn hơn em nghĩ 🥹`,
    tags: ['TanSinhVien', 'K20'],
    community: 'phenikaa',
    likes: 20,
    comments: [
      { by: 'phamduclong', text: 'Hiểu đệ quy 1 lần là đủ rồi, phần còn lại đệ quy tự lo 😂', after: 20, likes: 9 },
      { by: 'tranngocdiep', text: 'Gọi thầy là anh thì thầy vui lắm đó em 🤭', after: 45, likes: 6 },
      { by: 'khanhlinh_eat', text: 'mì tôm ít thôi em, đọc bài review quán của chị đi 😤', after: 60, likes: 5 }
    ]
  },
  {
    key: 'fun-dat-random',
    by: 'tiendat_ngo',
    daysAgo: 0,
    at: '10:05',
    content: `hôm nay mặc áo trái cả buổi sáng mà không ai nói. mình nên vui vì không ai để ý hay buồn vì không ai để ý`,
    tags: ['NghiVuVo'],
    likes: 9,
    comments: [
      { by: 'thuydung05', text: 'mình thấy nhưng tưởng là phong cách 😭', after: 12, likes: 7 }
    ]
  },
  {
    key: 'fun-quan-keyboard',
    by: 'minhquan_gg',
    daysAgo: 35,
    at: '21:00',
    content: `Mua bàn phím cơ switch xanh, bạn cùng phòng mua tai nghe chống ồn. Một sự cân bằng hoàn hảo của vũ trụ ⌨️`,
    tags: ['BanPhimCo', 'PhongTro'],
    images: [366],
    likes: 13,
    comments: [
      { by: 'minhtuan_dev', text: 'switch xanh ở phòng trọ là tội ác 😂', after: 15, likes: 6 },
      { by: 'tiendat_ngo', text: 'người bạn cùng phòng xứng đáng được giải Nobel hòa bình', after: 35, likes: 8 }
    ]
  },
  {
    key: 'fun-dung-lecturer-quote',
    by: 'thuydung05',
    daysAgo: 30,
    at: '15:40',
    content: `Thầy hôm nay: "Các em cứ hỏi đi, không có câu hỏi nào ngớ ngẩn cả."
Bạn mình: "Thầy ơi bài này có trong đề thi không ạ?"
Thầy: "...trừ câu đó."`,
    tags: ['TrenLop', 'Meme'],
    likes: 19,
    comments: [
      { by: 'dovanquang', text: 'Câu này thầy nào cũng từng nghe 😄 Câu trả lời luôn là: cái gì đã học đều có thể vào đề.', after: 200, likes: 12 },
      { by: 'vannam2k8', text: 'Em tưởng chỉ lớp em có 😂', after: 240 }
    ]
  }
]
