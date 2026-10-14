package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun ArnAboutDialog(
    isOpen: Boolean,
    onDismiss: () -> Unit
) {
    if (!isOpen) return

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.testTag("dialog_dismiss_button")
            ) {
                Text("إغلاق", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        },
        containerColor = ArnNavyCard,
        shape = RoundedCornerShape(20.dp),
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(ArnEmeraldPrimary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Verified,
                        contentDescription = "توثيق",
                        tint = ArnEmeraldPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Text(
                    text = "منصة ARN Stream",
                    style = MaterialTheme.typography.titleLarge,
                    color = ArnTextPrimary,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Prominent App Icon View
                Box(
                    modifier = Modifier
                        .size(90.dp)
                        .align(Alignment.CenterHorizontally)
                        .clip(RoundedCornerShape(20.dp))
                        .background(ArnNavySurface)
                        .border(2.dp, ArnEmeraldPrimary, RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    androidx.compose.foundation.Image(
                        painter = androidx.compose.ui.res.painterResource(id = com.example.R.drawable.img_arn_launcher_icon),
                        contentDescription = "ARN Stream App Icon",
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(20.dp))
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(ArnNavySurface)
                        .border(1.dp, ArnBorder, RoundedCornerShape(14.dp))
                        .padding(14.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("الشركة المالكة:", color = ArnTextSecondary, fontSize = 13.sp)
                            Text("ARN Technology", color = ArnGoldAccent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        HorizontalDivider(color = ArnBorder, thickness = 0.5.dp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("المطور والمهندس:", color = ArnTextSecondary, fontSize = 13.sp)
                            Text("عبده رجب نصار", color = ArnEmeraldGlow, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        HorizontalDivider(color = ArnBorder, thickness = 0.5.dp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("الإصدار:", color = ArnTextSecondary, fontSize = 13.sp)
                            Text("v1.0.0 (2026)", color = ArnTextPrimary, fontSize = 13.sp)
                        }
                    }
                }

                Text(
                    text = "عميل أندرويد الهجين فائق الأداء والمخصص لمنصة الوسائط المتكاملة ARN Stream Media Server، يدعم تشغيل الفيديو 4K/FHD بملء الشاشة، واكتشاف الخوادم التلقائي، والريموت كنترول التفاعلي.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = ArnTextSecondary,
                    lineHeight = 22.sp
                )

                Text(
                    text = "جميع حقوق النشر محفوظة (c) 2026 لشركة ARN Technology.",
                    style = MaterialTheme.typography.labelSmall,
                    color = ArnTextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    )
}
