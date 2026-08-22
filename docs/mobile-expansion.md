# 📱 Hướng dẫn Mở rộng Ứng dụng Di động — Mobile Expansion Guide

Tài liệu này hướng dẫn cách tích hợp ứng dụng **React Native (Expo)** vào Monorepo **PU Connector** bằng cách sử dụng thư viện **`react-native-reusables` (RNR)** kết hợp cùng các package dùng chung `@pu/schemas` và `@pu/ui`.

---

## 1. Tại sao chọn React Native + `react-native-reusables`?

1. **Đồng bộ triết lý với Web (Next.js + shadcn/ui):**
   * Web dùng `shadcn/ui` + Tailwind CSS.
   * Mobile dùng `react-native-reusables` + `NativeWind` (Tailwind trên React Native).
2. **Sở hữu 100% mã nguồn UI:** Copy-paste component vào thư mục dự án, không phụ thuộc vào các thư viện đóng gói đóng hộp (black-box UI libraries).
3. **Tái sử dụng tối đa:**
   * Dùng chung 100% các Zod Validation Schemas từ `@pu/schemas`.
   * Dùng chung bảng màu HSL và Design Tokens từ `@pu/ui`.

---

## 2. Các bước tích hợp `apps/mobile` vào Monorepo

### Bước 1: Khởi tạo Expo App trong thư mục `apps/mobile`
```bash
# Đứng tại thư mục gốc của Monorepo
pnpm create expo-app --template blank-typescript apps/mobile
```

### Bước 2: Cập nhật `apps/mobile/package.json`
Thêm các workspace dependencies:
```json
{
  "name": "@pu/mobile",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@pu/schemas": "workspace:*",
    "@pu/ui": "workspace:*",
    "expo": "~52.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "nativewind": "^4.1.23",
    "@rn-primitives/slot": "^1.1.0",
    "@rn-primitives/dialog": "^1.1.0",
    "@rn-primitives/dropdown-menu": "^1.1.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.2",
    "lucide-react-native": "^0.475.0"
  }
}
```

### Bước 3: Cấu hình Tailwind cho Mobile (`apps/mobile/tailwind.config.js`)
```javascript
const { themeTokens } = require('@pu/ui');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: 'hsl(var(--primary))',
        card: 'hsl(var(--card))',
        muted: 'hsl(var(--muted))'
      }
    }
  }
};
```

---

## 3. Ví dụ Sử dụng Code dùng chung trên Mobile

### Sử dụng Zod Schema từ `@pu/schemas`:
```typescript
import { CreatePostSchema, type CreatePostInput } from '@pu/schemas';

function handleMobileSubmit(data: CreatePostInput) {
  const validation = CreatePostSchema.safeParse(data);
  if (!validation.success) {
    alert(validation.error.errors[0].message);
    return;
  }
  // Gửi API lên NestJS Backend
}
```

### Ví dụ Component Button trên React Native:
```tsx
import * as React from 'react';
import { Pressable, Text } from 'react-native';
import { cn } from '@pu/ui';

export function MobileButton({ title, onPress, variant = 'default' }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-11 px-5 rounded-lg flex-row items-center justify-center',
        variant === 'default' && 'bg-primary text-primary-foreground',
        variant === 'outline' && 'border border-input bg-background'
      )}
    >
      <Text className="font-semibold text-sm">{title}</Text>
    </Pressable>
  );
}
```
