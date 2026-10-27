// Bộ thử kiểm duyệt tiếng Việt, nhãn tay. KHÔNG commit (chứa từ tục).
// group: heavy | medium | evasion | casual | insult | benign_hard | spam | normal
// unsafe: câu nên bị chặn/đưa duyệt (heavy, medium, evasion, insult); casual = chửi thân mật (báo riêng); spam = báo riêng.
const G = (group, unsafe, lines) => lines.map(text => ({ text, group, unsafe }))

export const DATA = [
  ...G('heavy', true, [
    'địt mẹ mày', 'địt con mẹ nó', 'đụ má mày', 'cái lồn gì vậy', 'mặt lồn', 'con cặc', 'cặc mày', 'buồi', 'thằng buồi',
    'đồ con đĩ', 'con điếm', 'đụ mẹ', 'địt', 'lồn trâu', 'vãi lồn', 'như cái lồn', 'ăn cặc đi', 'cút đi địt mẹ',
    'địt nhau không', 'mẹ mày địt', 'liếm lồn', 'bú cặc', 'thằng đĩ', 'lồn má', 'đĩ điếm'
  ]),
  ...G('medium', true, [
    'đm thằng này', 'đmm mày', 'đcm', 'đkm', 'vcl thật', 'vkl', 'cmm', 'clgt', 'đéo cần mày', 'đéo biết', 'cứt thật',
    'mẹ kiếp', 'đồ khốn nạn', 'thằng mất dạy', 'đồ vô học', 'đồ chó', 'thằng chó', 'óc chó', 'đồ súc vật', 'cút đi đồ cứt',
    'dmm', 'dcm', 'mày đúng là khốn nạn', 'clm', 'đm mày'
  ]),
  ...G('evasion', true, [
    'đ.m.m', 'đ m m', 'đ.m', 'd1t me', 'd!t me mày', 'dit me', 'du ma', 'l0n', 'l0n trau', 'c4c', 'đ.ị.t', 'đ.ụ má',
    'địtttttt', 'vclllll', 'đmmmmmm', 'lồnnnnn', 'đ-m mày', 'd.m.m', 'v.c.l', 'v c l', 'đ3o cần', 'd3o biết', 'dcmmm', 'cặcccc', 'b.u.ồ.i',
    'dit me may', 'đụụụ má', 'ĐỊT MẸ', 'Đ M', 'v.k.l'
  ]),
  ...G('casual', false, [
    'đm mệt quá', 'vcl hay thế', 'vkl đẹp vãi', 'đm lại deadline', 'vcl bài này khó', 'đéo hiểu bài này', 'đm hôm nay mưa',
    'vãi chưởng', 'vl thật sự', 'đm quán này ngon', 'mệt vcl', 'đm sáng nay trễ xe', 'vcl điểm cao thế', 'đéo muốn dậy', 'đm nóng quá',
    'đm thi xong rồi', 'clgt quên mang thẻ', 'vcl crush nhắn', 'đm nay đông thế', 'đéo có wifi'
  ]),
  ...G('insult', true, [
    'mày ngu quá', 'thằng ngu', 'đồ đần', 'bạn ngốc thật', 'cậu thiểu năng à', 'mày điên rồi', 'đồ khùng', 'đồ rác rưởi',
    'mày vô dụng', 'bọn ngu', 'bà ngu vừa thôi', 'ông đúng là đồ vô dụng', 'con nhỏ đó thiểu năng', 'ngu như bò', 'mày nên biến đi',
    'chị đúng là đồ rác rưởi', 'cái thằng ngu ngốc', 'bạn kém cỏi quá đi', 'cậu thật vô dụng', 'mày đần vừa thôi',
    'đồ ngu', 'lũ ngu ngốc', 'nói chuyện như thằng thiểu năng', 'mày không có não à', 'cả lớp ghét mày'
  ]),
  ...G('benign_hard', false, [
    'lon bia', 'mua 2 lon bia', 'một lon coca', 'lớn rồi mà', '5 dm', 'cái này dài 5 dm', 'gửi cc anh nhé', 'cc anh giúp em',
    'cac ban oi cho minh hoi', 'đủ mà', 'đi mẹ ơi', 'em đang ngủ', 'buổi sáng tốt lành', 'điên đảo vì deadline', 'điên cuồng chạy bài',
    'đeo khẩu trang', 'ngốc nghếch dễ thương', 'Địa điểm nộp bài ở đâu', 'dit', 'đụn rơm', 'cặp sách', 'buổi học',
    'dm vuông', 'phòng 5 dm2', 'cứu em với', 'cát trắng', 'đẹp lắm', 'cô giáo rất tận tâm', 'lồng tiếng phim', 'lốn nhốn', 'đội bóng thua',
    'lân la hỏi bài', 'đĩa CD', 'đĩa cơm tấm', 'cu li phòng thí nghiệm', 'chó mèo nhà em dễ thương', 'con chó nhà bạn đáng yêu', 'mình bị điên đầu vì bài tập'
  ]),
  ...G('spam', false, [
    'MUA NGAY GIÁ SỐC LIÊN HỆ 0912345678', 'kiếm tiền online 500k/ngày inbox zalo', 'vay tiền nhanh lãi suất 0% click link', 'bán acc game giá rẻ liên hệ',
    'tuyển CTV làm việc tại nhà thu nhập 20 triệu', 'đăng ký ngay http://bit.ly/abc123', 'hot hot hot hot hot hot hot', 'inbox mình nhận quà miễn phí',
    'đầu tư coin lãi 300% mỗi tuần', 'ib ib ib ib ib ib', 'bán thuốc tăng chiều cao cam kết', 'cá độ bóng đá uy tín t.me/xyz',
    'click vào đây để nhận iphone miễn phí', 'bán tài liệu photo giá rẻ zalo 0987654321 0987654321', 'FREESHIP TOÀN QUỐC ĐẶT NGAY!!!!!!!!!!'
  ]),
  ...G('normal', false, [
    'mọi người ơi cho mình hỏi lịch thi cuối kỳ', 'ai có tài liệu môn giải tích không ạ', 'hôm nay căng tin có món gì ngon?', 'nhóm mình cần thêm 1 bạn làm đồ án',
    'cảm ơn bạn nhiều nha', 'mai mấy giờ học môn lập trình vậy', 'thư viện mở cửa đến mấy giờ', 'cho mình xin file slide với',
    'mình đang tìm phòng trọ gần trường', 'chúc mọi người thi tốt', 'CLB tin học tuyển thành viên mới', 'sáng nay xe buýt trễ quá',
    'thầy cho nộp bài muộn được không ạ', 'ai đi ăn trưa cùng không', 'hôm nay trời đẹp ghê', 'mình bị lạc phòng B201, ai chỉ giúp',
    'học bổng kỳ này nộp hồ sơ ở đâu vậy?', 'bài tập nhóm khó quá trời', 'tối nay ôn thi ở thư viện nhé', 'hello mọi người',
    'bạn nào biết sửa laptop không', 'ký túc xá có wifi không ạ', 'mình mới nhập học, cho mình làm quen với', 'đề thi năm ngoái có ai giữ không',
    'cuối tuần đá bóng sân trường nha', 'giảng viên môn xác suất dạy dễ hiểu lắm', 'có ai bán lại giáo trình kinh tế vi mô không',
    'mình chia sẻ ghi chú môn cơ sở dữ liệu', 'em cảm ơn thầy ạ', 'trời nóng quá, ai uống trà sữa không'
  ])
]
