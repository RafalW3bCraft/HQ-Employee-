package com.webcraft.employee.presentation.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.webcraft.employee.domain.model.QualificationStatus
import com.webcraft.employee.presentation.theme.AmberWarning
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary
import com.webcraft.employee.presentation.theme.RoseError

@Composable
fun StatusBadge(status: QualificationStatus, modifier: Modifier = Modifier) {
    val (bgColor, textColor) = when (status) {
        QualificationStatus.NEW -> IndigoPrimary.copy(alpha = 0.2f) to IndigoPrimary
        QualificationStatus.CONTACTED,
        QualificationStatus.ENGAGED,
        QualificationStatus.QUALIFYING -> AmberWarning.copy(alpha = 0.2f) to AmberWarning
        QualificationStatus.QUALIFIED,
        QualificationStatus.MEETING_BOOKED,
        QualificationStatus.CONVERTED -> EmeraldSuccess.copy(alpha = 0.2f) to EmeraldSuccess
        QualificationStatus.MEETING_PENDING,
        QualificationStatus.HUMAN_HANDOFF -> CyanAccent.copy(alpha = 0.2f) to CyanAccent
        QualificationStatus.UNQUALIFIED,
        QualificationStatus.LOST -> RoseError.copy(alpha = 0.2f) to RoseError
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = status.name.replace('_', ' '),
            style = MaterialTheme.typography.labelSmall,
            color = textColor
        )
    }
}
