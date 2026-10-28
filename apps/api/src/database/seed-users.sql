-- Seed Data: 100 Realistic Users for Phenikaa University Connector (pu_connector_db)
-- Clear previous users (if any)
TRUNCATE TABLE users CASCADE;

INSERT INTO users (id, email, username, password_hash, display_name, student_id, interest_field_id, avatar_url, bio, role, status, reputation_points, created_at)
VALUES
-- FIT (Công nghệ thông tin) - K15, K16, K17, K18
(gen_random_uuid(), '22010001@phenikaa-uni.edu.vn', 'nguyenvanan', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Nguyễn Văn An', '22010001', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=An', 'Sinh viên K16 CNTT - Đam mê AI & Deep Learning', 'student', 'active', 450, NOW() - INTERVAL '30 days'),
(gen_random_uuid(), '22010002@phenikaa-uni.edu.vn', 'tranminhduc', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Trần Minh Đức', '22010002', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Duc', 'Fullstack Developer (Next.js, NestJS, Postgres)', 'student', 'active', 620, NOW() - INTERVAL '29 days'),
(gen_random_uuid(), '22010003@phenikaa-uni.edu.vn', 'lethimai', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Lê Thị Mai', '22010003', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mai', 'Thành viên CLB Tin học Phenikaa PRO', 'student', 'active', 380, NOW() - INTERVAL '28 days'),
(gen_random_uuid(), '22010004@phenikaa-uni.edu.vn', 'phamquanghuy', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Phạm Quang Huy', '22010004', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Huy', 'Mobile Developer (Flutter / React Native)', 'student', 'active', 510, NOW() - INTERVAL '28 days'),
(gen_random_uuid(), '22010005@phenikaa-uni.edu.vn', 'hoangthuytrang', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Hoàng Thùy Trang', '22010005', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Trang', 'Data Scientist intern & giải đề chuyên sâu', 'student', 'active', 720, NOW() - INTERVAL '27 days'),
(gen_random_uuid(), '23010006@phenikaa-uni.edu.vn', 'vudinhnam', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Vũ Đình Nam', '23010006', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nam', 'K17 Khoa CNTT - Đang học Cấu trúc dữ liệu & Giải thuật', 'student', 'active', 210, NOW() - INTERVAL '26 days'),
(gen_random_uuid(), '23010007@phenikaa-uni.edu.vn', 'danghaianh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đặng Hải Anh', '23010007', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=HaiAnh', 'Tìm nhóm làm bài tập lớn C++', 'student', 'active', 150, NOW() - INTERVAL '25 days'),
(gen_random_uuid(), '23010008@phenikaa-uni.edu.vn', 'buithuhuong', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Bùi Thu Hường', '23010008', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Huong', 'Thích thiết kế UI/UX Figma & Frontend', 'student', 'active', 290, NOW() - INTERVAL '25 days'),
(gen_random_uuid(), '21010009@phenikaa-uni.edu.vn', 'dothanhtung', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đỗ Thanh Tùng', '21010009', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tung', 'K15 CNTT - Đang làm Đồ án tốt nghiệp', 'student', 'active', 950, NOW() - INTERVAL '24 days'),
(gen_random_uuid(), '21010010@phenikaa-uni.edu.vn', 'nguyenngoctuyen', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Nguyễn Ngọc Tuyên', '21010010', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tuyen', 'DevOps & Cloud Engineer enthusiast', 'student', 'active', 840, NOW() - INTERVAL '24 days'),

-- FCS (Khoa học Máy tính & AI)
(gen_random_uuid(), '22010011@phenikaa-uni.edu.vn', 'nguyenducthong', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Nguyễn Đức Thông', '22010011', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thong', 'K16 Khoa học Máy tính - Nghiên cứu NLP & LLM', 'student', 'active', 680, NOW() - INTERVAL '23 days'),
(gen_random_uuid(), '22010012@phenikaa-uni.edu.vn', 'tranphuonglinh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Trần Phương Linh', '22010012', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linh', 'Phân tích dữ liệu & Machine Learning', 'student', 'active', 530, NOW() - INTERVAL '23 days'),
(gen_random_uuid(), '23010013@phenikaa-uni.edu.vn', 'lequocanh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Lê Quốc Anh', '23010013', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=QuocAnh', 'K17 AI - Đam mê thị giác máy tính Computer Vision', 'student', 'active', 310, NOW() - INTERVAL '22 days'),
(gen_random_uuid(), '23010014@phenikaa-uni.edu.vn', 'phamthanhtung', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Phạm Thanh Tùng', '23010014', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=ThanhTung', 'Robotics & AI Robot Phenikaa Team', 'student', 'active', 440, NOW() - INTERVAL '22 days'),
(gen_random_uuid(), '24010015@phenikaa-uni.edu.vn', 'hoangngocdiep', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Hoàng Ngọc Diệp', '24010015', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diep', 'K18 Tân sinh viên Khoa học Máy tính', 'student', 'active', 120, NOW() - INTERVAL '21 days'),

-- FEE (Điện - Điện tử & Tự động hóa)
(gen_random_uuid(), '22010016@phenikaa-uni.edu.vn', 'vutuananh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Vũ Tuấn Anh', '22010016', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=TuanAnh', 'Kỹ thuật Điện tử & Viễn thông K16', 'student', 'active', 490, NOW() - INTERVAL '21 days'),
(gen_random_uuid(), '22010017@phenikaa-uni.edu.vn', 'dangquangminh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đặng Quang Minh', '22010017', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Minh', 'Hệ thống nhúng & IoT', 'student', 'active', 580, NOW() - INTERVAL '20 days'),
(gen_random_uuid(), '23010018@phenikaa-uni.edu.vn', 'buiminhhoang', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Bùi Minh Hoàng', '23010018', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hoang', 'Tự động hóa & Điều khiển Robot', 'student', 'active', 320, NOW() - INTERVAL '20 days'),
(gen_random_uuid(), '23010019@phenikaa-uni.edu.vn', 'dovanphuc', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đỗ Văn Phúc', '23010019', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Phuc', 'Thành viên CLB Robocon Phenikaa', 'student', 'active', 410, NOW() - INTERVAL '19 days'),
(gen_random_uuid(), '21010020@phenikaa-uni.edu.vn', 'nguyenquocviet', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Nguyễn Quốc Việt', '21010020', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Viet', 'K15 Điện tử - Sẵn sàng giải đáp thắc mắc đồ án', 'student', 'active', 810, NOW() - INTERVAL '19 days'),

-- FAE (Kỹ thuật Ô tô & Cơ khí động lực)
(gen_random_uuid(), '22010021@phenikaa-uni.edu.vn', 'tranquocbao', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Trần Quốc Bảo', '22010021', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bao', 'K16 Kỹ thuật Ô tô - Đam mê xe điện EV', 'student', 'active', 470, NOW() - INTERVAL '18 days'),
(gen_random_uuid(), '22010022@phenikaa-uni.edu.vn', 'lethanhlong', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Lê Thành Long', '22010022', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Long', 'Autonomous Driving & Xe tự hành Phenikaa-X', 'student', 'active', 640, NOW() - INTERVAL '18 days'),
(gen_random_uuid(), '23010023@phenikaa-uni.edu.vn', 'phamhoangduy', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Phạm Hoàng Duy', '23010023', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Duy', 'Cơ điện tử ô tô & Mô phỏng Matlab', 'student', 'active', 280, NOW() - INTERVAL '17 days'),
(gen_random_uuid(), '23010024@phenikaa-uni.edu.vn', 'hoangvankhai', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Hoàng Văn Khải', '23010024', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Khai', 'Tìm nhóm làm Đồ án Động cơ đốt trong', 'student', 'active', 190, NOW() - INTERVAL '17 days'),
(gen_random_uuid(), '21010025@phenikaa-uni.edu.vn', 'vumanhcuong', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Vũ Mạnh Cường', '21010025', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cuong', 'Trưởng nhóm Đua xe sinh viên Phenikaa Racing', 'student', 'active', 930, NOW() - INTERVAL '16 days'),

-- FBA (Kinh tế & Quản trị Kinh doanh)
(gen_random_uuid(), '22010026@phenikaa-uni.edu.vn', 'dangthuha', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đặng Thu Hà', '22010026', (SELECT id FROM interest_fields WHERE code = 'school-econ'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ha', 'K16 Quản trị Kinh doanh - Marketing & Media', 'student', 'active', 560, NOW() - INTERVAL '16 days'),
(gen_random_uuid(), '22010027@phenikaa-uni.edu.vn', 'buingocanh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Bùi Ngọc Ánh', '22010027', (SELECT id FROM interest_fields WHERE code = 'school-econ'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=NgocAnh', 'Tài chính - Ngân hàng Phenikaa', 'student', 'active', 430, NOW() - INTERVAL '15 days'),
(gen_random_uuid(), '23010028@phenikaa-uni.edu.vn', 'dophuongthao', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đỗ Phương Thảo', '23010028', (SELECT id FROM interest_fields WHERE code = 'school-econ'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thao', 'Logistics & Quản lý chuỗi cung ứng', 'student', 'active', 360, NOW() - INTERVAL '15 days'),
(gen_random_uuid(), '23010029@phenikaa-uni.edu.vn', 'nguyenquangdat', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Nguyễn Quang Đạt', '23010029', (SELECT id FROM interest_fields WHERE code = 'school-econ'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dat', 'Thương mại điện tử & Kinh doanh số', 'student', 'active', 270, NOW() - INTERVAL '14 days'),
(gen_random_uuid(), '21010030@phenikaa-uni.edu.vn', 'tranthilan', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Trần Thị Lan', '21010030', (SELECT id FROM interest_fields WHERE code = 'school-econ'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lan', 'K15 Kế toán & Kiểm toán', 'student', 'active', 780, NOW() - INTERVAL '14 days'),

-- FEL (Ngôn ngữ Anh & Ngoại ngữ)
(gen_random_uuid(), '22010031@phenikaa-uni.edu.vn', 'lethanhhuong', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Lê Thanh Hương', '22010031', (SELECT id FROM interest_fields WHERE code = 'school-languages'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=HuongLe', 'K16 Ngôn ngữ Anh - IELTS 8.0', 'student', 'active', 890, NOW() - INTERVAL '13 days'),
(gen_random_uuid(), '22010032@phenikaa-uni.edu.vn', 'phamquynhanh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Phạm Quỳnh Anh', '22010032', (SELECT id FROM interest_fields WHERE code = 'school-languages'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=QuynhAnh', 'Tiếng Anh thương mại & Biên phiên dịch', 'student', 'active', 460, NOW() - INTERVAL '13 days'),
(gen_random_uuid(), '23010033@phenikaa-uni.edu.vn', 'hoangtuanminh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Hoàng Tuấn Minh', '23010033', (SELECT id FROM interest_fields WHERE code = 'school-languages'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=TuanMinh', 'Chủ nhiệm CLB Tiếng Anh Phenikaa English Zone', 'student', 'active', 670, NOW() - INTERVAL '12 days'),
(gen_random_uuid(), '23010034@phenikaa-uni.edu.vn', 'vuthithaonguyen', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Vũ Thị Thảo Nguyên', '23010034', (SELECT id FROM interest_fields WHERE code = 'school-languages'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=ThaoNguyen', 'Ngôn ngữ Trung Quốc K17', 'student', 'active', 310, NOW() - INTERVAL '12 days'),
(gen_random_uuid(), '24010035@phenikaa-uni.edu.vn', 'dangvietbac', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đặng Việt Bắc', '24010035', (SELECT id FROM interest_fields WHERE code = 'school-languages'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bac', 'K18 Ngôn ngữ Hàn Quốc', 'student', 'active', 140, NOW() - INTERVAL '11 days'),

-- FAS (Khoa học & Kỹ thuật Vật liệu)
(gen_random_uuid(), '22010036@phenikaa-uni.edu.vn', 'buiducthanh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Bùi Đức Thành', '22010036', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thanh', 'K16 Vật liệu Tiên tiến & Công nghệ Nano', 'student', 'active', 520, NOW() - INTERVAL '11 days'),
(gen_random_uuid(), '22010037@phenikaa-uni.edu.vn', 'dongocminh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đỗ Ngọc Minh', '22010037', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=NgocMinh', 'Polymer & Vật liệu Composite', 'student', 'active', 390, NOW() - INTERVAL '10 days'),
(gen_random_uuid(), '23010038@phenikaa-uni.edu.vn', 'nguyenhoanganh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Nguyễn Hoàng Anh', '23010038', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=HoangAnh', 'Nghiên cứu pin quang điện & Năng lượng mới', 'student', 'active', 450, NOW() - INTERVAL '10 days'),
(gen_random_uuid(), '23010039@phenikaa-uni.edu.vn', 'trandinhquy', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Trần Đình Quý', '23010039', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Quy', 'Kỹ thuật hóa học & môi trường', 'student', 'active', 260, NOW() - INTERVAL '9 days'),
(gen_random_uuid(), '21010040@phenikaa-uni.edu.vn', 'lethuyduong', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Lê Thùy Dương', '21010040', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Duong', 'K15 Khoa học Vật liệu - Phenikaa Research Lab', 'student', 'active', 860, NOW() - INTERVAL '9 days'),

-- FMS (Y Dược & Điều Dưỡng)
(gen_random_uuid(), '22010041@phenikaa-uni.edu.vn', 'phamquangdai', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Phạm Quang Đại', '22010041', (SELECT id FROM interest_fields WHERE code = 'school-health'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dai', 'Sinh viên Y Đa Khoa K16 - Bệnh viện ĐH Phenikaa', 'student', 'active', 750, NOW() - INTERVAL '8 days'),
(gen_random_uuid(), '22010042@phenikaa-uni.edu.vn', 'hoangthihuyen', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Hoàng Thị Huyền', '22010042', (SELECT id FROM interest_fields WHERE code = 'school-health'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Huyen', 'K16 Khoa Dược Phenikaa', 'student', 'active', 610, NOW() - INTERVAL '8 days'),
(gen_random_uuid(), '23010043@phenikaa-uni.edu.vn', 'vutronghieu', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Vũ Trọng Hiếu', '23010043', (SELECT id FROM interest_fields WHERE code = 'school-health'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hieu', 'K17 Y khoa - Trực viện & trao đổi ca lâm sàng', 'student', 'active', 430, NOW() - INTERVAL '7 days'),
(gen_random_uuid(), '23010044@phenikaa-uni.edu.vn', 'dangthimyhanh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Đặng Thị Mỹ Hạnh', '23010044', (SELECT id FROM interest_fields WHERE code = 'school-health'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hanh', 'Khoa Điều dưỡng & Phục hồi chức năng', 'student', 'active', 320, NOW() - INTERVAL '7 days'),
(gen_random_uuid(), '21010045@phenikaa-uni.edu.vn', 'buivanloc', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Bùi Văn Lộc', '21010045', (SELECT id FROM interest_fields WHERE code = 'school-health'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Loc', 'K15 Răng - Hàm - Mặt Phenikaa', 'student', 'active', 820, NOW() - INTERVAL '6 days'),

-- Giảng viên & Ban Cố Vấn (Lecturers & TAs)
(gen_random_uuid(), 'gv.nguyenvanha@phenikaa-uni.edu.vn', 'gv_nguyenvanha', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'TS. Nguyễn Văn Hà', 'GV001', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=GVHa', 'Giảng viên Bộ môn Hệ thống Thông tin - Khoa CNTT', 'lecturer', 'active', 2500, NOW() - INTERVAL '35 days'),
(gen_random_uuid(), 'gv.tranthithu@phenikaa-uni.edu.vn', 'gv_tranthithu', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'PGS.TS Trần Thị Thu', 'GV002', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=GVThu', 'Trưởng phòng Nghiên cứu Trí tuệ Nhân tạo', 'lecturer', 'active', 2800, NOW() - INTERVAL '35 days'),
(gen_random_uuid(), 'gv.lequangthang@phenikaa-uni.edu.vn', 'gv_lequangthang', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'TS. Lê Quang Thắng', 'GV003', (SELECT id FROM interest_fields WHERE code = 'school-eng'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=GVThang', 'Cố vấn chuyên môn Robocon & IoT Phenikaa', 'lecturer', 'active', 2400, NOW() - INTERVAL '35 days'),
(gen_random_uuid(), 'ta.phamthanhbinh@phenikaa-uni.edu.vn', 'ta_phamthanhbinh', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'ThS. Phạm Thanh Bình', 'TA001', (SELECT id FROM interest_fields WHERE code = 'school-it'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=TABinh', 'Trợ giảng bộ môn Cấu trúc dữ liệu & Lập trình Web', 'ta', 'active', 1250, NOW() - INTERVAL '32 days'),
(gen_random_uuid(), 'mod.phenikaa@phenikaa-uni.edu.vn', 'pu_admin_lead', '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS', 'Ban Quản Trị PU Connect', 'ADMIN01', NULL, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin', 'Quản trị viên diễn đàn sinh viên Đại học Phenikaa', 'admin', 'active', 5000, NOW() - INTERVAL '40 days');

-- Generate remaining 50 diverse student records dynamically with SQL loop
DO $$
DECLARE
    first_names TEXT[] := ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
    middle_names TEXT[] := ARRAY['Văn', 'Thị', 'Đức', 'Quang', 'Hải', 'Thanh', 'Minh', 'Ngọc', 'Hồng', 'Tuấn', 'Quốc', 'Hoàng', 'Thùy', 'Phương', 'Mai'];
    last_names TEXT[] := ARRAY['An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hùng', 'Huy', 'Khoa', 'Long', 'Lâm', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Tùng', 'Việt', 'Uyên', 'Yến', 'Nhi', 'Hương', 'Linh', 'Trang'];
    faculties_list TEXT[] := ARRAY['FIT', 'FCS', 'FEE', 'FAE', 'FBA', 'FEL', 'FAS', 'FMS'];
    years_list TEXT[] := ARRAY['2021-2025', '2022-2026', '2023-2027', '2024-2028'];
    v_fn TEXT;
    v_mn TEXT;
    v_ln TEXT;
    v_full_name TEXT;
    v_username TEXT;
    v_email TEXT;
    v_st_id VARCHAR(20);
    v_fac TEXT;
    v_yr TEXT;
    v_pts INT;
    i INT;
BEGIN
    FOR i IN 51..100 LOOP
        v_fn := first_names[1 + floor(random() * array_length(first_names, 1))::int];
        v_mn := middle_names[1 + floor(random() * array_length(middle_names, 1))::int];
        v_ln := last_names[1 + floor(random() * array_length(last_names, 1))::int];
        v_full_name := v_fn || ' ' || v_mn || ' ' || v_ln;
        
        v_st_id := (22000000 + i)::text;
        v_username := 'student_' || v_st_id;
        v_email := v_st_id || '@phenikaa-uni.edu.vn';
        v_fac := faculties_list[1 + floor(random() * array_length(faculties_list, 1))::int];
        v_yr := years_list[1 + floor(random() * array_length(years_list, 1))::int];
        v_pts := 50 + floor(random() * 950)::int;

        INSERT INTO users (id, email, username, password_hash, display_name, student_id, interest_field_id, avatar_url, bio, role, status, reputation_points, created_at)
        VALUES (
            gen_random_uuid(),
            v_email,
            v_username,
            '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS',
            v_full_name,
            v_st_id,
            (SELECT id FROM interest_fields WHERE code = CASE v_fac WHEN 'FIT' THEN 'school-it' WHEN 'FCS' THEN 'school-it' WHEN 'FEE' THEN 'school-eng' WHEN 'FAE' THEN 'school-eng' WHEN 'FAS' THEN 'school-eng' WHEN 'FBA' THEN 'school-econ' WHEN 'FEL' THEN 'school-languages' WHEN 'FMS' THEN 'school-health' END),
            'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_st_id,
            'Sinh viên ' || v_fac || ' - Phenikaa University (' || v_yr || ')',
            'student',
            'active',
            v_pts,
            NOW() - (i || ' hours')::INTERVAL
        );
    END LOOP;
END $$;
