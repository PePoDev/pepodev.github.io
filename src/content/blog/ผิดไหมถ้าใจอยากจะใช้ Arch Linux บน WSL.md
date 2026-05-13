---
url-slug: arch-linux-wsl
sub-title: วิธีการติดตั้ง Linux distro ใดๆก็ตามที่เราต้องการลงบน WSL
cover-picture: ../../assets/blog/f52421dd-89d5-4f42-a460-5e971498c57f.webp
publish: true
dg-publish: true
---
## เกริ่นนำ
มีช่วงนึงที่เราหันไปใช้ Linux แบบจริงๆจังๆ จนเราได้ไปลอง Distro ตัวหนึ่งที่ชื่อ Arch Linux ในตอนนั้นเราก็ตกหลุมรักเข้ากับมนต์เสน่ห์แปลกๆของมัน ไม่ว่าจะการอัพเดตที่มีมาบ่อยจนรู้สึกหวาดกลัว หรือ package manager ที่แสนจะอัจฉริยะอย่างเจ้า pacman ทำให้เราต้องการนำมันกลับมาใช้งานใน WSL บนคอมเครื่องหลักของเรา แต่หลังจากที่ลอง search บน Windows Store เราเจอแต่ unofficial package ที่ไม่ได้อัพเดตมาหลายเดือนแล้ว เลยไปลองหาข้อมูลเพิ่มจนได้ใจความว่า ในปัจจุบันมี project open-source อยู่ตัวหนึ่งชื่อว่า [wsldl](https://github.com/yuk7/wsldl) ที่เราไว้ติดตั้ง rootfs หรือ disk image (ext4 vhdx) ใดๆก็ตามลงใน WSL ซึ่งเขาก็ได้ทำ rootfs สำหรับ Arch Linux ไว้ด้วยให้เราใช้ติดตั้งลงบน WSL ได้เลย ซึ่ง Package บน Windows Store ที่เราเจอก็เอาอันนี้ไปใช้นี่แหละ แต่เดี๋ยวเราจะมาลงกันเองเพื่อความ up-to-date!

> สำหรับคนที่ไม่รู้จัก WSL มันก็คือเครื่องมือที่ช่วยให้นักพัฒนาสามารถใช้งานความสามารถของ Linux ได้โดยที่ไม่จ้องไปปวดหัวกับการทำ virtual machine หรือการทำ dual boot แต่ก็มาปวดหัวกับ WSL อยู่ดีนะ 😂

## ลงมือ
ด้วยความที่เจ้าของโปรเจ็คนี้ได้เตรียมอะไรหลายๆอย่างไว้ให้เราแล้ว ทำให้การติดตั้งนั้นมีหลายวิธีและค่อนข้างง่าย และในวันนี้เราจะใช้วิธีการติดตั้งผ่าน appx เพราะว่าง่ายมว๊าก เราสามารถทำตามขั้นตอนนี้ได้เลย

1. เข้าไปดาวน์โหลด[ตัวติดตั้ง](https://github.com/yuk7/ArchWSL/releases/latest)ที่เป็น `.appx` กับตัว `.cer` มาไว้ที่เครื่องเราซึ่งเราก็เลือกแบบ AppX หรือ Online-AppX ก็ได้จะแตกต่างแค่ Online จะเป็นไฟล์ขนาดนั้นเล็ก จะมีการโหลดเพิ่มระหว่างการติดตั้งเฉยๆ
2. พอทำการโหลดทุกอย่างเสร็จเรียบร้อยก็ทำการ Install Cer เข้าไปก่อนเผื่อเป็นการยืนยันว่าเราเชื่อถือผู้พัฒนานี้ ก็คลิกตาม [docs](https://wsldl-pg.github.io/ArchW-docs/Install-Certificate/) นี้ได้เลย
3. ขั้นตอนสุดท้ายก็ดับเบิ้ลคลิก `.appx` เพื่อทำการ install ก็เป็นอันเสร็จพิธีครับ

> appx ก็คือ package file ของ windows ที่เอาไว้ใช้แจกจ่ายสำหรับการติดตั้ง application ที่เป็น Universal Windows Platform (UWP) ส่วนมากใช้สำหรับนำแอพขึ้น Windows Store

นอกจาก Arch Linux แล้ว เรายังสามารถเอา wsldl มาใช้ได้กับทุก distro ที่เราต้องการได้เลย สามารถใช้กับ CPU ประเภท ARM ได้อีกด้วย

ขอให้สนุกกับ WSL ครับ 👋
## References
- [https://learn.microsoft.com/en-us/windows/wsl/install](https://learn.microsoft.com/en-us/windows/wsl/install)
- [https://github.com/yuk7/wsldl](https://github.com/yuk7/wsldl)
- [https://github.com/yuk7/ArchWSL](https://github.com/yuk7/ArchWSL)
- [https://wsldl-pg.github.io/ArchW-docs/](https://wsldl-pg.github.io/ArchW-docs/)